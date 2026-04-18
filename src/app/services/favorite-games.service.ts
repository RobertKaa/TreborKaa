import { Injectable, computed, signal } from '@angular/core';
import { GAME_CATALOG, GameId } from '../data/game-catalog';

type FavoriteStore = Partial<Record<GameId, true>>;

const STORAGE_KEY = 'findtheflag.favorites.v1';
const VALID_IDS = new Set<GameId>(GAME_CATALOG.map((game) => game.id));

@Injectable({ providedIn: 'root' })
export class FavoriteGamesService {
  private readonly favorites = signal<FavoriteStore>(this.loadFromStorage());

  readonly snapshot = computed(() => this.favorites());
  readonly count = computed(() => Object.keys(this.favorites()).length);
  readonly ids = computed(
    () => GAME_CATALOG.map((game) => game.id).filter((id) => this.favorites()[id]) as GameId[]
  );

  isFavorite(gameId: GameId): boolean {
    return !!this.favorites()[gameId];
  }

  toggle(gameId: GameId): void {
    this.favorites.update((current) => {
      if (current[gameId]) {
        const next = { ...current };
        delete next[gameId];
        return next;
      }

      return {
        ...current,
        [gameId]: true
      };
    });

    this.persist();
  }

  private loadFromStorage(): FavoriteStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      const next: FavoriteStore = {};
      for (const key of Object.keys(parsed)) {
        if (VALID_IDS.has(key as GameId) && parsed[key] === true) {
          next[key as GameId] = true;
        }
      }

      return next;
    } catch {
      return {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites()));
    } catch {
      // Ignore storage errors.
    }
  }
}
