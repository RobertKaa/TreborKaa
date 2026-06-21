-- Harden remaining public SECURITY DEFINER RPCs exposed to authenticated users.
-- request_account_deletion: SECURITY INVOKER + bounded RLS on account_deletion_requests.
-- sync_authoritative_xp_claims: SECURITY INVOKER batch calling private DEFINER helpers
-- (private schema is not exposed through PostgREST /rest/v1/rpc/).

-- ---------------------------------------------------------------------------
-- GDPR: account deletion request
-- ---------------------------------------------------------------------------

drop policy if exists "Users can request own account deletion"
on public.account_deletion_requests;

create policy "Users can request own account deletion"
on public.account_deletion_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and confirmation_phrase = 'SUPPRIMER MON COMPTE'
);

drop policy if exists "Users can update own account deletion request"
on public.account_deletion_requests;

create policy "Users can update own account deletion request"
on public.account_deletion_requests
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and confirmation_phrase = 'SUPPRIMER MON COMPTE'
);

grant insert, update on table public.account_deletion_requests to authenticated;

create or replace function public.request_account_deletion(p_confirmation text)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  requested_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(trim(p_confirmation), '') <> 'SUPPRIMER MON COMPTE' then
    raise exception 'Invalid confirmation phrase';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    requested_at,
    confirmation_phrase
  )
  values (
    current_user_id,
    requested_at,
    'SUPPRIMER MON COMPTE'
  )
  on conflict (user_id) do update
  set
    requested_at = excluded.requested_at,
    confirmation_phrase = excluded.confirmation_phrase;

  return requested_at;
end;
$$;

revoke all on function public.request_account_deletion(text) from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Authoritative XP: private DEFINER helpers + public INVOKER batch RPC
-- ---------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, authenticated;

create or replace function private.claim_achievement_xp(p_achievement_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  xp_amount integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  xp_amount := public.achievement_xp_amount(p_achievement_id);

  if xp_amount is null then
    raise exception 'Unsupported achievement id';
  end if;

  if not exists (
    select 1
    from public.achievement_unlocks
    where achievement_unlocks.user_id = current_user_id
      and achievement_unlocks.achievement_id = p_achievement_id
  ) then
    raise exception 'Achievement not unlocked';
  end if;

  insert into public.xp_events (
    user_id,
    source_id,
    source_type,
    amount,
    metadata,
    awarded_at
  )
  values (
    current_user_id,
    'achievement:' || p_achievement_id,
    'achievement',
    xp_amount,
    jsonb_build_object('achievement_id', p_achievement_id),
    now()
  )
  on conflict (user_id, source_id) do nothing;

  return found;
end;
$$;

create or replace function private.claim_record_xp(p_record_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  record_row public.personal_records%rowtype;
  xp_amount integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_record_key not in (
    'country-to-flag-easy',
    'flag-to-country-easy',
    'shape-to-country-easy',
    'flag-rebuild',
    'find-the-error',
    'pixel-flag',
    'chrono-flags'
  ) then
    raise exception 'Unsupported record key';
  end if;

  select *
  into record_row
  from public.personal_records
  where personal_records.user_id = current_user_id
    and personal_records.record_key = p_record_key;

  if not found then
    raise exception 'Record not found';
  end if;

  xp_amount := public.calculate_record_xp_amount(
    record_row.games_played,
    record_row.best_percent,
    record_row.best_score,
    record_row.best_streak
  );

  if xp_amount <= 0 then
    return false;
  end if;

  insert into public.xp_events (
    user_id,
    source_id,
    source_type,
    amount,
    metadata,
    awarded_at
  )
  values (
    current_user_id,
    'record:' || p_record_key,
    'game_completion',
    xp_amount,
    jsonb_build_object(
      'record_key', p_record_key,
      'games_played', record_row.games_played,
      'best_percent', record_row.best_percent
    ),
    now()
  )
  on conflict (user_id, source_id) do nothing;

  return found;
end;
$$;

revoke all on function private.claim_achievement_xp(text) from public, anon;
grant execute on function private.claim_achievement_xp(text) to authenticated, service_role;

revoke all on function private.claim_record_xp(text) from public, anon;
grant execute on function private.claim_record_xp(text) to authenticated, service_role;

drop function if exists public.claim_achievement_xp(text);
drop function if exists public.claim_record_xp(text);

create or replace function public.sync_authoritative_xp_claims()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  achievement_claimed integer := 0;
  record_claimed integer := 0;
  achievement_row record;
  record_key_value text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  for achievement_row in
    select achievement_unlocks.achievement_id
    from public.achievement_unlocks
    where achievement_unlocks.user_id = current_user_id
  loop
    if private.claim_achievement_xp(achievement_row.achievement_id) then
      achievement_claimed := achievement_claimed + 1;
    end if;
  end loop;

  for record_key_value in
    select personal_records.record_key
    from public.personal_records
    where personal_records.user_id = current_user_id
  loop
    if private.claim_record_xp(record_key_value) then
      record_claimed := record_claimed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'achievement_claimed', achievement_claimed,
    'record_claimed', record_claimed
  );
end;
$$;

revoke all on function public.sync_authoritative_xp_claims() from public, anon;
grant execute on function public.sync_authoritative_xp_claims() to authenticated;
