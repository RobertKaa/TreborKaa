import { Injectable, computed, signal } from '@angular/core';
import { GameRecordKey, GameResultPayload, PersonalRecord } from '../models/personal-record';

type StoredRecords = Partial<Record<GameRecordKey, PersonalRecord>>;

const STORAGE_KEY = 'findtheflag.personal-records.v1';

@Injectable({ providedIn: 'root' })
export class PersonalRecordsService {
  private readonly records = signal<StoredRecords>(this.loadFromStorage());
  readonly snapshot = computed(() => this.records());

  getRecord(key: GameRecordKey): PersonalRecord | null {
    return this.records()[key] ?? null;
  }

  saveResult(key: GameRecordKey, payload: GameResultPayload): PersonalRecord {
    const safeScore = Math.max(0, Math.round(payload.score));
    const safeMax = Math.max(1, Math.round(payload.maxScore));
    const computedPercent = Math.round((safeScore / safeMax) * 100);
    const percent = Math.max(
      0,
      Math.min(100, Math.round(payload.percentOverride ?? computedPercent))
    );
    const nowIso = new Date().toISOString();
    const existing = this.records()[key];
    const isBetter =
      !existing ||
      percent > existing.bestPercent ||
      (percent === existing.bestPercent && safeScore > existing.bestScore);

    const nextRecord: PersonalRecord = {
      bestScore: isBetter ? safeScore : (existing?.bestScore ?? safeScore),
      bestMaxScore: isBetter ? safeMax : (existing?.bestMaxScore ?? safeMax),
      bestPercent: isBetter ? percent : (existing?.bestPercent ?? percent),
      gamesPlayed: (existing?.gamesPlayed ?? 0) + 1,
      lastPlayedAt: nowIso,
      bestStreak: Math.max(existing?.bestStreak ?? 0, payload.streak ?? 0)
    };

    this.records.update((records) => ({
      ...records,
      [key]: nextRecord
    }));
    this.persist();

    return nextRecord;
  }

  clearAll(): void {
    this.records.set({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  private loadFromStorage(): StoredRecords {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as StoredRecords;
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records()));
    } catch {
      // Ignore storage errors.
    }
  }
}
