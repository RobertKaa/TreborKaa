-- Daily challenge streak bonus: progressive XP up to +1000, computed server-side.

drop policy if exists "Users can claim bounded daily challenge XP"
on public.xp_events;

create or replace function public.calculate_daily_streak_bonus(p_streak_days integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  streak_days integer := greatest(0, coalesce(p_streak_days, 0));
  capped_streak integer;
begin
  if streak_days <= 1 then
    return 0;
  end if;

  capped_streak := least(streak_days, 30);
  return round(((capped_streak - 1)::numeric / 29) * 1000)::integer;
end;
$$;

create or replace function public.compute_daily_challenge_streak(
  p_user_id uuid,
  p_date date
)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  streak integer := 1;
  check_date date := p_date - 1;
begin
  while check_date >= p_date - 90 loop
    if exists (
      select 1
      from public.xp_events
      where xp_events.user_id = p_user_id
        and xp_events.source_type = 'daily_challenge'
        and xp_events.source_id = 'daily-challenge:' || check_date::text
    ) then
      streak := streak + 1;
      check_date := check_date - 1;
    else
      exit;
    end if;
  end loop;

  return streak;
end;
$$;

create or replace function public.claim_daily_challenge_xp(p_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  streak_days integer;
  streak_bonus integer;
  total_amount integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_date is null or p_date > current_date or p_date < current_date - 90 then
    raise exception 'Invalid daily challenge date';
  end if;

  streak_days := public.compute_daily_challenge_streak(current_user_id, p_date);
  streak_bonus := public.calculate_daily_streak_bonus(streak_days);
  total_amount := 250 + streak_bonus;

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
    total_amount,
    jsonb_build_object(
      'date', p_date::text,
      'base_xp', 250,
      'streak_days', streak_days,
      'streak_bonus', streak_bonus
    ),
    now()
  )
  on conflict (user_id, source_id) do nothing;

  return found;
end;
$$;

revoke all on function public.calculate_daily_streak_bonus(integer) from public, anon, authenticated;
revoke all on function public.compute_daily_challenge_streak(uuid, date) from public, anon, authenticated;
revoke all on function public.claim_daily_challenge_xp(date) from public, anon;
grant execute on function public.claim_daily_challenge_xp(date) to authenticated;
