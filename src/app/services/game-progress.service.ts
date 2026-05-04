import { Injectable, computed, inject, signal } from '@angular/core';
import { GameId } from '../data/game-catalog';
import { BrowserStorageService } from './browser-storage.service';

type ProgressLabelParams = Record<string, string | number>;

export type GameProgressEntry = {
  gameId: GameId;
  percent: number;
  labelKey: string;
  labelParams?: ProgressLabelParams;
  updatedAt: string;
  payload: unknown;
};

type ProgressStore = Partial<Record<GameId, GameProgressEntry>>;

const STORAGE_KEY = 'vexiio.game-progress.v1';

@Injectable({ providedIn: 'root' })
export class GameProgressService {
  private readonly storage = inject(BrowserStorageService);
  private readonly store = signal<ProgressStore>(this.loadFromStorage());
  readonly snapshot = computed(() => this.store());
  readonly count = computed(() => Object.keys(this.store()).length);

  getProgress(gameId: GameId): GameProgressEntry | null {
    return this.store()[gameId] ?? null;
  }

  getPayload<T>(gameId: GameId): T | null {
    const progress = this.getProgress(gameId);
    if (!progress) {
      return null;
    }

    return progress.payload as T;
  }

  saveProgress(
    gameId: GameId,
    payload: unknown,
    view: {
      percent: number;
      labelKey: string;
      labelParams?: ProgressLabelParams;
    },
  ): void {
    const nextEntry: GameProgressEntry = {
      gameId,
      payload,
      percent: Math.max(0, Math.min(100, Math.round(view.percent))),
      labelKey: view.labelKey,
      labelParams: view.labelParams,
      updatedAt: new Date().toISOString(),
    };

    this.store.update((current) => ({
      ...current,
      [gameId]: nextEntry,
    }));
    this.persist();
  }

  clearProgress(gameId: GameId): void {
    this.store.update((current) => {
      if (!current[gameId]) {
        return current;
      }

      const next = { ...current };
      delete next[gameId];
      return next;
    });
    this.persist();
  }

  mergeProgress(entries: readonly GameProgressEntry[]): void {
    const next: ProgressStore = { ...this.store() };

    for (const entry of entries) {
      const existing = next[entry.gameId];
      const existingTime = existing ? Date.parse(existing.updatedAt) : 0;
      const incomingTime = Date.parse(entry.updatedAt);

      if (!existing || incomingTime >= existingTime) {
        next[entry.gameId] = entry;
      }
    }

    this.store.set(next);
    this.persist();
  }

  private loadFromStorage(): ProgressStore {
    const parsed = this.storage.getJson<ProgressStore>(STORAGE_KEY, {});
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed;
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.store());
  }
}
