grant insert (user_id, personal_records_reset_at)
on table public.user_profiles
to authenticated;

grant update (personal_records_reset_at)
on table public.user_profiles
to authenticated;

create or replace function public.reset_personal_records()
returns timestamptz
language plpgsql
security invoker
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
