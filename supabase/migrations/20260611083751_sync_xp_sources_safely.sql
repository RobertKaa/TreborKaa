create or replace function public.merge_personal_records(p_records jsonb)
returns setof public.personal_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  record_item jsonb;
  record_key_value text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'Invalid personal records payload';
  end if;

  if jsonb_array_length(p_records) > 20 then
    raise exception 'Invalid personal records payload';
  end if;

  for record_item in
    select value
    from jsonb_array_elements(p_records)
  loop
    record_key_value := record_item ->> 'record_key';

    if record_key_value not in (
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

    insert into public.personal_records (
      user_id,
      record_key,
      best_score,
      best_max_score,
      best_percent,
      games_played,
      best_streak,
      last_played_at
    )
    values (
      current_user_id,
      record_key_value,
      greatest(0, least(1000000, coalesce((record_item ->> 'best_score')::integer, 0))),
      greatest(1, least(1000000, coalesce((record_item ->> 'best_max_score')::integer, 1))),
      greatest(0, least(100, coalesce((record_item ->> 'best_percent')::integer, 0))),
      greatest(0, least(1000000, coalesce((record_item ->> 'games_played')::integer, 0))),
      greatest(0, least(1000000, coalesce((record_item ->> 'best_streak')::integer, 0))),
      coalesce((record_item ->> 'last_played_at')::timestamptz, now())
    )
    on conflict (user_id, record_key) do update
    set
      best_score = case
        when excluded.best_percent > personal_records.best_percent
          or (
            excluded.best_percent = personal_records.best_percent
            and excluded.best_score > personal_records.best_score
          )
        then excluded.best_score
        else personal_records.best_score
      end,
      best_max_score = case
        when excluded.best_percent > personal_records.best_percent
          or (
            excluded.best_percent = personal_records.best_percent
            and excluded.best_score > personal_records.best_score
          )
        then excluded.best_max_score
        else personal_records.best_max_score
      end,
      best_percent = greatest(personal_records.best_percent, excluded.best_percent),
      games_played = greatest(personal_records.games_played, excluded.games_played),
      best_streak = greatest(personal_records.best_streak, excluded.best_streak),
      last_played_at = greatest(personal_records.last_played_at, excluded.last_played_at),
      updated_at = now();
  end loop;

  return query
  select personal_records.*
  from public.personal_records
  where personal_records.user_id = current_user_id;
end;
$$;

revoke all on function public.merge_personal_records(jsonb) from public, anon;
grant execute on function public.merge_personal_records(jsonb) to authenticated;

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
