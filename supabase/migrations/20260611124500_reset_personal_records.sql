alter table public.user_profiles
add column if not exists personal_records_reset_at timestamptz;

create or replace function public.reset_personal_records()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  reset_at timestamptz := clock_timestamp();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_profiles (
    user_id,
    personal_records_reset_at
  )
  values (
    current_user_id,
    reset_at
  )
  on conflict (user_id) do update
  set personal_records_reset_at = excluded.personal_records_reset_at;

  delete from public.personal_records
  where user_id = current_user_id;

  return reset_at;
end;
$$;

revoke all on function public.reset_personal_records() from public, anon;
grant execute on function public.reset_personal_records() to authenticated;

create or replace function public.merge_personal_records(p_records jsonb)
returns setof public.personal_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  records_reset_at timestamptz;
  record_item jsonb;
  record_key_value text;
  last_played_at_value timestamptz;
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

  select user_profiles.personal_records_reset_at
  into records_reset_at
  from public.user_profiles
  where user_profiles.user_id = current_user_id;

  for record_item in
    select value
    from jsonb_array_elements(p_records)
  loop
    record_key_value := record_item ->> 'record_key';
    last_played_at_value := coalesce((record_item ->> 'last_played_at')::timestamptz, now());

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

    if records_reset_at is not null and last_played_at_value <= records_reset_at then
      continue;
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
      last_played_at_value
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
