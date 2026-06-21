-- Remove legacy Google avatar URLs from public application tables.
-- Supabase Auth can keep provider metadata in the protected auth schema, but
-- public app tables must not expose third-party profile image URLs.

alter table public.user_profiles
drop column if exists avatar_url;

alter table public.speedrun_leaderboard
drop column if exists avatar_url;

revoke insert, update on table public.user_profiles from authenticated;

grant insert (user_id, display_name, locale, personal_records_reset_at)
on table public.user_profiles
to authenticated;

grant update (display_name, locale, personal_records_reset_at)
on table public.user_profiles
to authenticated;
