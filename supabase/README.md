# Supabase schema

This folder stores the database migrations required by Vexiio.

## Current model

- `user_profiles`: public application profile linked to `auth.users`.
- `favorite_games`: synced favorite game ids per user.
- `personal_records`: synced personal records per user.
- `achievement_unlocks`: synced unlocked achievement ids per user.
- `game_runs`: reserved for future validated run history or leaderboards.

`game_progress` existed in the first schema but was removed by
`20260519182613_harden_user_data_rls.sql` because progress now stays local to
avoid noisy writes.

## Security notes

- Authentication is handled by Supabase Auth.
- The browser only uses the publishable key.
- RLS must remain enabled on every public user-data table.
- User-scoped policies must always constrain rows with `(select auth.uid()) = user_id`.
- Public or competitive leaderboards must not be written directly from Angular.

## Codex MCP access

The Supabase MCP server is functional when Codex Desktop is restarted after OAuth login. A working
session must expose the Supabase tools and allow a basic `list_tables` call on the `public` schema.

If the desktop session cannot refresh the OAuth token:

1. Run `codex.cmd mcp logout supabase`.
2. Run `codex.cmd mcp login supabase`.
3. Restart Codex Desktop.
4. Verify the MCP tools in a fresh session before applying migrations.

On Windows, prefer `codex.cmd` or Git Bash if PowerShell blocks `codex.ps1`.
