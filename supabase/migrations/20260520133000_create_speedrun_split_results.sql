-- Store per-split Speedrun results. Writes stay server-only through Edge
-- Functions; authenticated users can read their own split history and public
-- reads only access sanitized best split rows.

create table if not exists public.speedrun_split_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.speedrun_run_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  split_id text not null check (
    split_id in (
      'country-to-flag-hard',
      'flag-to-country-hard',
      'capital-to-country',
      'shape-to-country'
    )
  ),
  split_order integer not null check (split_order between 1 and 4),
  raw_time_ms integer not null check (raw_time_ms >= 0),
  penalty_ms integer not null check (penalty_ms >= 0),
  total_time_ms integer not null check (total_time_ms >= 0),
  mistake_count integer not null default 0 check (mistake_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (attempt_id, split_id)
);

create table if not exists public.speedrun_split_bests (
  user_id uuid not null references auth.users(id) on delete cascade,
  split_id text not null check (
    split_id in (
      'country-to-flag-hard',
      'flag-to-country-hard',
      'capital-to-country',
      'shape-to-country'
    )
  ),
  attempt_id uuid not null references public.speedrun_run_attempts(id) on delete cascade,
  total_time_ms integer not null check (total_time_ms >= 0),
  raw_time_ms integer not null check (raw_time_ms >= 0),
  penalty_ms integer not null check (penalty_ms >= 0),
  mistake_count integer not null default 0 check (mistake_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, split_id)
);

create index if not exists speedrun_split_results_user_completed_idx
on public.speedrun_split_results (user_id, completed_at desc);

create index if not exists speedrun_split_results_attempt_order_idx
on public.speedrun_split_results (attempt_id, split_order asc);

create index if not exists speedrun_split_bests_rank_idx
on public.speedrun_split_bests (split_id, total_time_ms asc, completed_at asc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_speedrun_split_bests_updated_at'
  ) then
    create trigger set_speedrun_split_bests_updated_at
    before update on public.speedrun_split_bests
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.speedrun_split_results enable row level security;
alter table public.speedrun_split_bests enable row level security;

drop policy if exists "Users can read own speedrun split results"
on public.speedrun_split_results;

create policy "Users can read own speedrun split results"
on public.speedrun_split_results
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own speedrun split bests"
on public.speedrun_split_bests;

create policy "Users can read own speedrun split bests"
on public.speedrun_split_bests
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.speedrun_split_results from anon, authenticated;
revoke all on table public.speedrun_split_bests from anon, authenticated;

grant select on table public.speedrun_split_results to authenticated;
grant select on table public.speedrun_split_bests to authenticated;
