import { Injectable, computed, inject, signal } from '@angular/core';
import { GameRecordKey, GameResultPayload, PersonalRecord } from '../models/personal-record';
import { BrowserStorageService } from './browser-storage.service';

type StoredRecords = Partial<Record<GameRecordKey, PersonalRecord>>;

const STORAGE_KEY = 'vexiio.personal-records.v1';

@Injectable({ providedIn: 'root' })
export class PersonalRecordsService {
  private readonly storage = inject(BrowserStorageService);
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
      Math.min(100, Math.round(payload.percentOverride ?? computedPercent)),
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
      bestStreak: Math.max(existing?.bestStreak ?? 0, payload.streak ?? 0),
    };

    this.records.update((records) => ({
      ...records,
      [key]: nextRecord,
    }));
    this.persist();

    return nextRecord;
  }

  clearAll(): void {
    this.records.set({});
    this.storage.remove(STORAGE_KEY);
  }

  private loadFromStorage(): StoredRecords {
    const parsed = this.storage.getJson<StoredRecords>(STORAGE_KEY, {});
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.records());
  }
}
