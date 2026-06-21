-- GDPR export and account deletion request audit trail.

create or replace function public.export_user_data()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  exported_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  return jsonb_build_object(
    'exported_at', exported_at,
    'user_id', current_user_id,
    'profile', (
      select to_jsonb(profile_row)
      from (
        select
          user_profiles.user_id,
          user_profiles.display_name,
          user_profiles.avatar_key,
          user_profiles.locale,
          user_profiles.personal_records_reset_at,
          user_profiles.created_at,
          user_profiles.updated_at
        from public.user_profiles
        where user_profiles.user_id = current_user_id
      ) as profile_row
    ),
    'personal_records', coalesce(
      (
        select jsonb_agg(to_jsonb(record_row) order by record_row.record_key)
        from (
          select
            personal_records.record_key,
            personal_records.best_score,
            personal_records.best_max_score,
            personal_records.best_percent,
            personal_records.games_played,
            personal_records.best_streak,
            personal_records.last_played_at,
            personal_records.updated_at
          from public.personal_records
          where personal_records.user_id = current_user_id
        ) as record_row
      ),
      '[]'::jsonb
    ),
    'achievement_unlocks', coalesce(
      (
        select jsonb_agg(to_jsonb(achievement_row) order by achievement_row.achievement_id)
        from (
          select
            achievement_unlocks.achievement_id,
            achievement_unlocks.unlocked_at,
            achievement_unlocks.source
          from public.achievement_unlocks
          where achievement_unlocks.user_id = current_user_id
        ) as achievement_row
      ),
      '[]'::jsonb
    ),
    'xp_events', coalesce(
      (
        select jsonb_agg(to_jsonb(xp_row) order by xp_row.awarded_at desc)
        from (
          select
            xp_events.source_id,
            xp_events.source_type,
            xp_events.amount,
            xp_events.metadata,
            xp_events.awarded_at
          from public.xp_events
          where xp_events.user_id = current_user_id
        ) as xp_row
      ),
      '[]'::jsonb
    ),
    'speedrun_leaderboard', (
      select to_jsonb(speedrun_row)
      from (
        select
          speedrun_leaderboard.display_name,
          speedrun_leaderboard.avatar_key,
          speedrun_leaderboard.total_time_ms,
          speedrun_leaderboard.raw_time_ms,
          speedrun_leaderboard.penalty_ms,
          speedrun_leaderboard.mistake_count,
          speedrun_leaderboard.correct_count,
          speedrun_leaderboard.completed_at,
          speedrun_leaderboard.updated_at
        from public.speedrun_leaderboard
        where speedrun_leaderboard.user_id = current_user_id
      ) as speedrun_row
    ),
    'speedrun_split_bests', coalesce(
      (
        select jsonb_agg(to_jsonb(split_row) order by split_row.split_id)
        from (
          select
            speedrun_split_bests.split_id,
            speedrun_split_bests.total_time_ms,
            speedrun_split_bests.raw_time_ms,
            speedrun_split_bests.penalty_ms,
            speedrun_split_bests.mistake_count,
            speedrun_split_bests.completed_at,
            speedrun_split_bests.updated_at
          from public.speedrun_split_bests
          where speedrun_split_bests.user_id = current_user_id
        ) as split_row
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.export_user_data() from public, anon;
grant execute on function public.export_user_data() to authenticated;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  confirmation_phrase text not null,
  unique (user_id)
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can read own deletion requests"
on public.account_deletion_requests;

create policy "Users can read own deletion requests"
on public.account_deletion_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.account_deletion_requests from anon, authenticated;
grant select on table public.account_deletion_requests to authenticated;

create or replace function public.request_account_deletion(p_confirmation text)
returns timestamptz
language plpgsql
security definer
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
