-- Event log for future authoritative XP awards.
-- The frontend currently computes XP from owned records and achievements; this
-- table gives Edge Functions a deduplicated target for server-awarded sources.

create table if not exists public.xp_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  source_type text not null check (
    source_type in (
      'achievement',
      'daily_challenge',
      'game_completion',
      'speedrun',
      'system'
    )
  ),
  amount integer not null check (amount > 0),
  metadata jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, source_id)
);

create index if not exists xp_events_user_awarded_idx
on public.xp_events (user_id, awarded_at desc);

create index if not exists xp_events_source_type_idx
on public.xp_events (source_type, awarded_at desc);

alter table public.xp_events enable row level security;

drop policy if exists "Users can read own XP events"
on public.xp_events;

create policy "Users can read own XP events"
on public.xp_events
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.xp_events from anon, authenticated;
grant select on table public.xp_events to authenticated;
