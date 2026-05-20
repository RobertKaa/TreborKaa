-- Harden user-scoped data access after the first Supabase RLS audit.
-- The frontend only needs Google profile sync, favorites, personal records and
-- achievement unlock sync. Progress stays local and competitive/public runs
-- should not be written directly by the browser yet.

drop table if exists public.game_progress;

alter table public.user_profiles enable row level security;
alter table public.favorite_games enable row level security;
alter table public.personal_records enable row level security;
alter table public.achievement_unlocks enable row level security;
alter table public.game_runs enable row level security;

drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can read own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Users can manage own favorites" on public.favorite_games;
drop policy if exists "Users can manage own records" on public.personal_records;
drop policy if exists "Users can manage own achievements" on public.achievement_unlocks;
drop policy if exists "Users can manage own runs" on public.game_runs;

create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own profile"
on public.user_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own profile"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read own favorites"
on public.favorite_games
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own favorites"
on public.favorite_games
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete own favorites"
on public.favorite_games
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own records"
on public.personal_records
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own records"
on public.personal_records
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own records"
on public.personal_records
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own records"
on public.personal_records
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own achievements"
on public.achievement_unlocks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own achievements"
on public.achievement_unlocks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own achievements"
on public.achievement_unlocks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own achievements"
on public.achievement_unlocks
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own runs"
on public.game_runs
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.user_profiles from anon, authenticated;
revoke all on table public.favorite_games from anon, authenticated;
revoke all on table public.personal_records from anon, authenticated;
revoke all on table public.achievement_unlocks from anon, authenticated;
revoke all on table public.game_runs from anon, authenticated;

grant select on table public.user_profiles to authenticated;
grant insert (user_id, display_name, avatar_url, locale) on public.user_profiles to authenticated;
grant update (user_id, display_name, avatar_url, locale) on public.user_profiles to authenticated;

grant select, insert, delete on table public.favorite_games to authenticated;
grant select, insert, update, delete on table public.personal_records to authenticated;
grant select, insert, update, delete on table public.achievement_unlocks to authenticated;
grant select on table public.game_runs to authenticated;
