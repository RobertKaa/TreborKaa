-- Initial Vexiio user-data schema.
-- This migration contains only application data tables. Authentication remains
-- owned by Supabase Auth in the `auth` schema.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  locale text not null default 'fr',
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  achievement_points integer not null default 0 check (achievement_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorite_games (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.game_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  label_key text not null,
  label_params jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.personal_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  best_score integer not null default 0 check (best_score >= 0),
  best_max_score integer not null default 1 check (best_max_score >= 1),
  best_percent integer not null default 0 check (best_percent >= 0 and best_percent <= 100),
  games_played integer not null default 0 check (games_played >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_played_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_key)
);

create table if not exists public.achievement_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  source jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_id)
);

create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  record_key text,
  score integer not null default 0 check (score >= 0),
  max_score integer not null default 1 check (max_score >= 1),
  percent integer not null default 0 check (percent >= 0 and percent <= 100),
  streak integer not null default 0 check (streak >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create index if not exists favorite_games_user_created_idx
on public.favorite_games (user_id, created_at desc);

create index if not exists game_progress_user_updated_idx
on public.game_progress (user_id, updated_at desc);

create index if not exists personal_records_user_updated_idx
on public.personal_records (user_id, updated_at desc);

create index if not exists achievement_unlocks_user_unlocked_idx
on public.achievement_unlocks (user_id, unlocked_at desc);

create index if not exists game_runs_user_completed_idx
on public.game_runs (user_id, completed_at desc);

create index if not exists game_runs_game_completed_idx
on public.game_runs (game_id, completed_at desc);

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger set_game_progress_updated_at
before update on public.game_progress
for each row execute function public.set_updated_at();

create trigger set_personal_records_updated_at
before update on public.personal_records
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.favorite_games enable row level security;
alter table public.game_progress enable row level security;
alter table public.personal_records enable row level security;
alter table public.achievement_unlocks enable row level security;
alter table public.game_runs enable row level security;

create policy "Users can insert own profile"
on public.user_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update own profile"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own favorites"
on public.favorite_games
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own progress"
on public.game_progress
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own records"
on public.personal_records
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own achievements"
on public.achievement_unlocks
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own runs"
on public.game_runs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
