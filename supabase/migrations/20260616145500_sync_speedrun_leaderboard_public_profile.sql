-- Keep public leaderboard identity aligned with the sanitized user profile.

create or replace function public.apply_speedrun_leaderboard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_display_name text;
  profile_avatar_key text;
begin
  select user_profiles.display_name, user_profiles.avatar_key
  into profile_display_name, profile_avatar_key
  from public.user_profiles
  where user_profiles.user_id = new.user_id;

  new.display_name = coalesce(profile_display_name, new.display_name);
  new.avatar_key = coalesce(profile_avatar_key, new.avatar_key, 'fr');

  return new;
end;
$$;

drop trigger if exists apply_speedrun_leaderboard_profile
on public.speedrun_leaderboard;

create trigger apply_speedrun_leaderboard_profile
before insert or update on public.speedrun_leaderboard
for each row
execute function public.apply_speedrun_leaderboard_profile();

create or replace function public.sync_speedrun_leaderboard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.speedrun_leaderboard
  set
    display_name = coalesce(new.display_name, speedrun_leaderboard.display_name),
    avatar_key = coalesce(new.avatar_key, speedrun_leaderboard.avatar_key, 'fr'),
    updated_at = now()
  where user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists sync_speedrun_leaderboard_profile
on public.user_profiles;

create trigger sync_speedrun_leaderboard_profile
after insert or update of display_name, avatar_key on public.user_profiles
for each row
execute function public.sync_speedrun_leaderboard_profile();
