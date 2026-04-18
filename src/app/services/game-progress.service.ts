import { Injectable, computed, signal } from '@angular/core';
import { GameId } from '../data/game-catalog';

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
    }
  ): void {
    const nextEntry: GameProgressEntry = {
      gameId,
      payload,
      percent: Math.max(0, Math.min(100, Math.round(view.percent))),
      labelKey: view.labelKey,
      labelParams: view.labelParams,
      updatedAt: new Date().toISOString()
    };

    this.store.update((current) => ({
      ...current,
      [gameId]: nextEntry
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

  private loadFromStorage(): ProgressStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as ProgressStore;
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      return parsed;
    } catch {
      return {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store()));
    } catch {
      // Ignore storage errors.
    }
  }
}
