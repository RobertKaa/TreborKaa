-- Favorites were removed from the product surface and no longer need remote sync.
do $$
begin
  if to_regclass('public.favorite_games') is not null then
    drop policy if exists "Users can read own favorites" on public.favorite_games;
    drop policy if exists "Users can insert own favorites" on public.favorite_games;
    drop policy if exists "Users can delete own favorites" on public.favorite_games;
    drop policy if exists "Users can manage own favorites" on public.favorite_games;

    revoke all on table public.favorite_games from anon, authenticated;
  end if;
end $$;

drop table if exists public.favorite_games;
