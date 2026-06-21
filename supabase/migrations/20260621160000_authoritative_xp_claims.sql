-- Authoritative XP claims for achievements and personal records.
-- Daily challenge and speedrun XP remain on their existing paths.

drop policy if exists "Users can claim bounded daily challenge XP"
on public.xp_events;

revoke insert on table public.xp_events from authenticated;

create or replace function public.claim_daily_challenge_xp(p_date date)
returns boolean
language plpgsql
security definer
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

create or replace function public.calculate_record_xp_amount(
  p_games_played integer,
  p_best_percent integer,
  p_best_score integer,
  p_best_streak integer
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  games_played integer := greatest(0, coalesce(p_games_played, 0));
  best_percent integer := greatest(0, least(100, coalesce(p_best_percent, 0)));
  best_score integer := greatest(0, coalesce(p_best_score, 0));
  best_streak integer := greatest(0, coalesce(p_best_streak, 0));
  counted_repeat_runs integer;
  low_value_repeat_runs integer;
  completion_xp numeric;
  anti_farm_multiplier numeric;
  performance_xp numeric;
begin
  if games_played = 0 then
    return 0;
  end if;

  counted_repeat_runs := least(greatest(games_played - 1, 0), 20);
  low_value_repeat_runs := greatest(games_played - 1 - 20, 0);
  completion_xp :=
    150
    + counted_repeat_runs * 12
    + low_value_repeat_runs * 2;

  anti_farm_multiplier := case
    when best_percent < 30 then 0.25
    when best_percent < 50 then 0.6
    else 1
  end;

  performance_xp :=
    best_percent * 2
    + best_streak * 15
    + least(greatest(best_score, 0), 500);

  return round(completion_xp * anti_farm_multiplier + performance_xp)::integer;
end;
$$;

create or replace function public.achievement_xp_amount(p_achievement_id text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_achievement_id
    when 'first-game' then 50
    when 'five-runs' then 50
    when 'resume-ready' then 50
    when 'three-games' then 125
    when 'seven-games' then 125
    when 'accuracy-90' then 125
    when 'visual-trio' then 125
    when 'chrono-sprinter' then 125
    when 'rebuild-architect' then 125
    when 'collector-level-5' then 125
    when 'perfect-score' then 250
    when 'twenty-runs' then 250
    when 'fifty-runs' then 250
    when 'three-perfect-records' then 250
    when 'all-excellent' then 250
    when 'streak-master' then 250
    when 'streak-legend' then 250
    when 'chrono-expert' then 250
    when 'rebuild-master' then 250
    when 'all-available-games' then 250
    when 'collector-level-10' then 250
    when 'collector-level-20' then 250
    when 'mystery-combo' then 400
    when 'mystery-clean-tour' then 400
    when 'mystery-full-house' then 400
    when 'mystery-seven-perfect' then 400
    when 'mystery-centurion' then 400
    else null
  end;
$$;

create or replace function public.claim_achievement_xp(p_achievement_id text)
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

create or replace function public.claim_record_xp(p_record_key text)
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

create or replace function public.sync_authoritative_xp_claims()
returns jsonb
language plpgsql
security definer
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
    if public.claim_achievement_xp(achievement_row.achievement_id) then
      achievement_claimed := achievement_claimed + 1;
    end if;
  end loop;

  for record_key_value in
    select personal_records.record_key
    from public.personal_records
    where personal_records.user_id = current_user_id
  loop
    if public.claim_record_xp(record_key_value) then
      record_claimed := record_claimed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'achievement_claimed', achievement_claimed,
    'record_claimed', record_claimed
  );
end;
$$;

revoke all on function public.calculate_record_xp_amount(integer, integer, integer, integer)
from public, anon, authenticated;
revoke all on function public.achievement_xp_amount(text) from public, anon, authenticated;

revoke all on function public.claim_achievement_xp(text) from public, anon;
grant execute on function public.claim_achievement_xp(text) to authenticated;

revoke all on function public.claim_record_xp(text) from public, anon;
grant execute on function public.claim_record_xp(text) to authenticated;

revoke all on function public.sync_authoritative_xp_claims() from public, anon;
grant execute on function public.sync_authoritative_xp_claims() to authenticated;
