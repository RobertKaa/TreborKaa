-- Secure Speedrun leaderboard schema.
-- Public reads are limited to sanitized leaderboard rows. Frontend writes are
-- intentionally blocked; Edge Functions must write with the service role.

create table if not exists public.speedrun_run_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'submitted', 'rejected')),
  seed text not null,
  step_plan jsonb not null default '[]'::jsonb,
  raw_time_ms integer check (raw_time_ms is null or raw_time_ms >= 0),
  penalty_ms integer check (penalty_ms is null or penalty_ms >= 0),
  total_time_ms integer check (total_time_ms is null or total_time_ms >= 0),
  mistake_count integer not null default 0 check (mistake_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  validation_error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.speedrun_leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.speedrun_run_attempts(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  total_time_ms integer not null check (total_time_ms >= 0),
  raw_time_ms integer not null check (raw_time_ms >= 0),
  penalty_ms integer not null check (penalty_ms >= 0),
  mistake_count integer not null check (mistake_count >= 0),
  correct_count integer not null check (correct_count >= 0),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists speedrun_attempts_user_started_idx
on public.speedrun_run_attempts (user_id, started_at desc);

create index if not exists speedrun_attempts_status_started_idx
on public.speedrun_run_attempts (status, started_at desc);

create index if not exists speedrun_leaderboard_rank_idx
on public.speedrun_leaderboard (total_time_ms asc, completed_at asc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_speedrun_attempts_updated_at'
  ) then
    create trigger set_speedrun_attempts_updated_at
    before update on public.speedrun_run_attempts
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_speedrun_leaderboard_updated_at'
  ) then
    create trigger set_speedrun_leaderboard_updated_at
    before update on public.speedrun_leaderboard
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.speedrun_run_attempts enable row level security;
alter table public.speedrun_leaderboard enable row level security;

drop policy if exists "Users can read own speedrun attempts"
on public.speedrun_run_attempts;

create policy "Users can read own speedrun attempts"
on public.speedrun_run_attempts
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Anyone can read speedrun leaderboard"
on public.speedrun_leaderboard;

create policy "Anyone can read speedrun leaderboard"
on public.speedrun_leaderboard
for select
to anon, authenticated
using (true);

revoke all on table public.speedrun_run_attempts from anon, authenticated;
revoke all on table public.speedrun_leaderboard from anon, authenticated;

grant select on table public.speedrun_run_attempts to authenticated;
grant select on table public.speedrun_leaderboard to anon, authenticated;
