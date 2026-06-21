-- Trigger helpers must not be callable through the public RPC API.

revoke all on function public.apply_speedrun_leaderboard_profile() from public, anon, authenticated;
revoke all on function public.sync_speedrun_leaderboard_profile() from public, anon, authenticated;
