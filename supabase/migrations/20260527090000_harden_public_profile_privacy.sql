-- Minimize public profile data after the RGPD/security audit.
-- Google avatars are no longer used by the app and public leaderboard names
-- are reset to deterministic pseudonyms instead of provider names or emails.

update public.user_profiles
set display_name = 'Joueur ' || upper(substr(replace(user_id::text, '-', ''), 1, 6))
where display_name is distinct from 'Joueur ' || upper(substr(replace(user_id::text, '-', ''), 1, 6));

update public.speedrun_leaderboard
set display_name = 'Joueur ' || upper(substr(replace(user_id::text, '-', ''), 1, 6))
where display_name is distinct from 'Joueur ' || upper(substr(replace(user_id::text, '-', ''), 1, 6));

alter table public.user_profiles
drop column if exists avatar_url;

alter table public.speedrun_leaderboard
drop column if exists avatar_url;

alter table public.user_profiles
drop constraint if exists user_profiles_display_name_safe;

alter table public.user_profiles
add constraint user_profiles_display_name_safe
check (
  display_name is null
  or (
    char_length(display_name) between 3 and 18
    and display_name !~* '(@|https?://|www\.)'
  )
);

alter table public.speedrun_leaderboard
drop constraint if exists speedrun_leaderboard_display_name_safe;

alter table public.speedrun_leaderboard
add constraint speedrun_leaderboard_display_name_safe
check (
  char_length(display_name) between 3 and 18
  and display_name !~* '(@|https?://|www\.)'
);

revoke insert, update on table public.user_profiles from authenticated;
grant insert (user_id, display_name, locale) on public.user_profiles to authenticated;
grant update (user_id, display_name, locale) on public.user_profiles to authenticated;
