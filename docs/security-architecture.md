# Security architecture

## Public leaderboards

Vexiio can keep personal records in the frontend-backed Supabase tables while they remain private,
user-scoped data protected by RLS. These records are useful for profile sync, achievements and
resume flows, but they must not be used as the trusted source for public competitive rankings.

If public leaderboards are added later, score writes must go through a backend validation boundary:

- Supabase Edge Function, or another controlled backend endpoint.
- The endpoint must verify the authenticated user session server-side.
- The endpoint must validate the submitted game mode, score range, duration and anti-abuse rules.
- Public leaderboard tables must not allow direct `INSERT` or `UPDATE` from the browser client.
- Public reads can be exposed through a limited view or RPC returning only display-safe fields.

## Current boundary

Current user data tables are acceptable for non-competitive private data:

- `personal_records`
- `achievement_unlocks`
- `user_profiles`

The frontend may sync these tables with the Supabase publishable key because RLS limits each user to
their own rows. This model is not enough for competitive features because a browser can still submit
arbitrary values for its own user.

## Required implementation for future rankings

Before adding a public leaderboard:

1. Create a dedicated table, for example `public_leaderboard_entries`.
2. Disable direct client writes with RLS and grants.
3. Add an Edge Function or backend endpoint that performs all writes.
4. Add server-side validation tests for accepted and rejected payloads.
5. Add client tests to ensure Angular calls the backend endpoint instead of writing directly to a
   leaderboard table.

This keeps the current UX flexible while preserving a trustworthy path for public rankings.
