-- Store only a safe local flag key for public profile visuals.
-- This replaces legacy external avatar URLs in public leaderboard displays.

alter table public.user_profiles
add column if not exists avatar_key text not null default 'fr';

alter table public.speedrun_leaderboard
add column if not exists avatar_key text not null default 'fr';

alter table public.user_profiles
drop constraint if exists user_profiles_avatar_key_safe;

alter table public.user_profiles
add constraint user_profiles_avatar_key_safe
check (avatar_key ~ '^[a-z]{2}$');

alter table public.speedrun_leaderboard
drop constraint if exists speedrun_leaderboard_avatar_key_safe;

alter table public.speedrun_leaderboard
add constraint speedrun_leaderboard_avatar_key_safe
check (avatar_key ~ '^[a-z]{2}$');

update public.user_profiles as profile
set avatar_key = case
  when lower(coalesce(auth_user.raw_user_meta_data ->> 'vexiio_avatar_key', '')) ~ '^[a-z]{2}$'
    then lower(auth_user.raw_user_meta_data ->> 'vexiio_avatar_key')
  else 'fr'
end
from auth.users as auth_user
where profile.user_id = auth_user.id;

update public.speedrun_leaderboard as leaderboard
set avatar_key = case
  when lower(coalesce(auth_user.raw_user_meta_data ->> 'vexiio_avatar_key', '')) ~ '^[a-z]{2}$'
    then lower(auth_user.raw_user_meta_data ->> 'vexiio_avatar_key')
  else 'fr'
end
from auth.users as auth_user
where leaderboard.user_id = auth_user.id;

revoke insert, update on table public.user_profiles from authenticated;

grant insert (user_id, display_name, avatar_key, locale, personal_records_reset_at)
on table public.user_profiles
to authenticated;

grant update (display_name, avatar_key, locale, personal_records_reset_at)
on table public.user_profiles
to authenticated;
