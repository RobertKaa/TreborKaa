import { Injectable, computed, inject, signal } from '@angular/core';
import {
  SpeedrunRunResult,
  SPEEDRUN_SPLITS,
  SpeedrunSplitBest,
  SpeedrunSplitId,
  SpeedrunSplitResult,
  SpeedrunUserRecord,
} from '../models/speedrun';
import { BrowserStorageService } from './browser-storage.service';

type SpeedrunUserRecordStore = {
  bestRun?: SpeedrunUserRecord;
  splitBests?: Partial<Record<SpeedrunSplitId, SpeedrunSplitBest>>;
};

type SpeedrunRecordStore = Record<string, SpeedrunUserRecord | SpeedrunUserRecordStore>;
type NormalizedSpeedrunRecordStore = Record<string, SpeedrunUserRecordStore>;

const STORAGE_KEY = 'vexiio.speedrun.records.v1';

@Injectable({ providedIn: 'root' })
export class SpeedrunRecordsService {
  private readonly storage = inject(BrowserStorageService);
  private readonly records = signal<NormalizedSpeedrunRecordStore>(this.loadFromStorage());

  readonly snapshot = computed(() => this.records());

  getBestForUser(userId: string | null | undefined): SpeedrunUserRecord | null {
    if (!userId) {
      return null;
    }

    return this.records()[userId]?.bestRun ?? null;
  }

  saveBestForUser(userId: string, result: SpeedrunRunResult): SpeedrunUserRecord {
    const existing = this.getBestForUser(userId);
    const next: SpeedrunUserRecord = {
      ...result,
      userId,
    };

    if (existing && existing.totalTimeMs <= next.totalTimeMs) {
      return existing;
    }

    this.records.update((records) => {
      const userStore = records[userId] ?? {};

      return {
        ...records,
        [userId]: {
          ...userStore,
          bestRun: next,
        },
      };
    });
    this.persist();

    return next;
  }

  getBestSplitForUser(
    userId: string | null | undefined,
    splitId: SpeedrunSplitId,
  ): SpeedrunSplitBest | null {
    if (!userId) {
      return null;
    }

    return this.records()[userId]?.splitBests?.[splitId] ?? null;
  }

  saveSplitBestsForUser(userId: string, splitResults: SpeedrunSplitResult[]): SpeedrunSplitBest[] {
    const savedBests: SpeedrunSplitBest[] = [];

    this.records.update((records) => {
      const userStore = records[userId] ?? {};
      const splitBests = { ...(userStore.splitBests ?? {}) };

      for (const splitResult of splitResults) {
        const existing = splitBests[splitResult.splitId];
        if (existing && existing.totalTimeMs <= splitResult.totalTimeMs) {
          savedBests.push(existing);
          continue;
        }

        const nextBest: SpeedrunSplitBest = {
          splitId: splitResult.splitId,
          totalTimeMs: splitResult.totalTimeMs,
          rawTimeMs: splitResult.rawTimeMs,
          penaltyMs: splitResult.penaltyMs,
          mistakeCount: splitResult.mistakeCount,
          completedAt: splitResult.completedAt,
        };
        splitBests[splitResult.splitId] = nextBest;
        savedBests.push(nextBest);
      }

      return {
        ...records,
        [userId]: {
          ...userStore,
          splitBests,
        },
      };
    });

    this.persist();
    return savedBests;
  }

  getTheoreticalBestForUser(userId: string | null | undefined): number | null {
    if (!userId) {
      return null;
    }

    const splitBests = this.records()[userId]?.splitBests;
    if (!splitBests) {
      return null;
    }

    const bests = SPEEDRUN_SPLITS.map((split) => splitBests[split.id]);
    if (bests.some((best) => !best)) {
      return null;
    }

    return bests.reduce((total, best) => total + best!.totalTimeMs, 0);
  }

  private loadFromStorage(): NormalizedSpeedrunRecordStore {
    const parsed = this.storage.getJson<SpeedrunRecordStore>(STORAGE_KEY, {});
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([userId, value]) => [
        userId,
        this.normalizeUserStore(userId, value),
      ]),
    );
  }

  private normalizeUserStore(
    userId: string,
    value: SpeedrunUserRecord | SpeedrunUserRecordStore,
  ): SpeedrunUserRecordStore {
    const possibleStore = value as SpeedrunUserRecordStore;
    if ('bestRun' in possibleStore || 'splitBests' in possibleStore) {
      return possibleStore;
    }

    const legacyRecord = value as SpeedrunUserRecord;
    return {
      bestRun: {
        ...legacyRecord,
        userId,
      },
    };
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.records());
  }
}
