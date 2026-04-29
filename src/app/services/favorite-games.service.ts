import { Injectable, computed, inject, signal } from '@angular/core';
import { GAME_CATALOG, GameId } from '../data/game-catalog';
import { BrowserStorageService } from './browser-storage.service';

type FavoriteStore = Partial<Record<GameId, true>>;

const STORAGE_KEY = 'vexiio.favorites.v1';
const VALID_IDS = new Set<GameId>(GAME_CATALOG.map((game) => game.id));

@Injectable({ providedIn: 'root' })
export class FavoriteGamesService {
  private readonly storage = inject(BrowserStorageService);
  private readonly favorites = signal<FavoriteStore>(this.loadFromStorage());

  readonly snapshot = computed(() => this.favorites());
  readonly count = computed(() => Object.keys(this.favorites()).length);
  readonly ids = computed(
    () => GAME_CATALOG.map((game) => game.id).filter((id) => this.favorites()[id]) as GameId[],
  );

  isFavorite(gameId: GameId): boolean {
    return !!this.favorites()[gameId];
  }

  toggle(gameId: GameId): void {
    this.set(gameId, !this.isFavorite(gameId));
  }

  set(gameId: GameId, isFavorite: boolean): void {
    this.favorites.update((current) => {
      if (!isFavorite) {
        const next = { ...current };
        delete next[gameId];
        return next;
      }

      return {
        ...current,
        [gameId]: true,
      };
    });

    this.persist();
  }

  private loadFromStorage(): FavoriteStore {
    const parsed = this.storage.getJson<Record<string, unknown>>(STORAGE_KEY, {});
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
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.favorites());
  }
}
