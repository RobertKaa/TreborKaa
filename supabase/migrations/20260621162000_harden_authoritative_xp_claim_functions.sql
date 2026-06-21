-- Internal claim helpers must not be callable through the public RPC API.
-- Client-facing surface: sync_authoritative_xp_claims (SECURITY DEFINER batch)
-- and claim_daily_challenge_xp (SECURITY INVOKER with bounded RLS insert).

revoke all on function public.claim_achievement_xp(text) from public, anon, authenticated;
revoke all on function public.claim_record_xp(text) from public, anon, authenticated;

drop policy if exists "Users can claim bounded daily challenge XP"
on public.xp_events;

create policy "Users can claim bounded daily challenge XP"
on public.xp_events
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and source_type = 'daily_challenge'
  and amount = 250
  and source_id = 'daily-challenge:' || (metadata ->> 'date')
  and case
    when (metadata ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
    then (metadata ->> 'date')::date between current_date - 90 and current_date
    else false
  end
);

grant insert on table public.xp_events to authenticated;

create or replace function public.claim_daily_challenge_xp(p_date date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_date is null or p_date > current_date or p_date < current_date - 90 then
    raise exception 'Invalid daily challenge date';
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
    'daily-challenge:' || p_date::text,
    'daily_challenge',
    250,
    jsonb_build_object('date', p_date::text),
    now()
  )
  on conflict (user_id, source_id) do nothing;

  return found;
end;
$$;

revoke all on function public.claim_daily_challenge_xp(date) from public, anon;
grant execute on function public.claim_daily_challenge_xp(date) to authenticated;
