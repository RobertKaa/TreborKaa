import { Injectable, computed, inject, signal } from '@angular/core';
import { GameRecordKey, GameResultPayload, PersonalRecord } from '../models/personal-record';
import { BrowserStorageService } from './browser-storage.service';

type StoredRecords = Partial<Record<GameRecordKey, PersonalRecord>>;

const STORAGE_KEY = 'vexiio.personal-records.v1';
const VALID_RECORD_KEYS = new Set<GameRecordKey>([
  'country-to-flag-easy',
  'flag-to-country-easy',
  'shape-to-country-easy',
  'flag-rebuild',
  'find-the-error',
  'pixel-flag',
  'chrono-flags',
]);

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

  discardAtOrBefore(resetAt: string | null): void {
    if (!resetAt) {
      return;
    }

    const resetTimestamp = Date.parse(resetAt);
    if (!Number.isFinite(resetTimestamp)) {
      return;
    }

    const next: StoredRecords = {};
    let changed = false;

    for (const [key, record] of Object.entries(this.records()) as [
      GameRecordKey,
      PersonalRecord,
    ][]) {
      const playedAt = Date.parse(record.lastPlayedAt);
      if (!Number.isFinite(playedAt) || playedAt <= resetTimestamp) {
        changed = true;
        continue;
      }

      next[key] = record;
    }

    if (!changed) {
      return;
    }

    this.records.set(next);
    this.persist();
  }

  mergeRecords(records: StoredRecords): void {
    const next: StoredRecords = { ...this.records() };
    let changed = false;

    for (const [key, incoming] of Object.entries(records) as [GameRecordKey, PersonalRecord][]) {
      if (!VALID_RECORD_KEYS.has(key)) {
        continue;
      }

      const existing = next[key];
      const merged = this.mergeRecord(existing, incoming);
      if (!existing || !this.recordsAreEqual(existing, merged)) {
        next[key] = merged;
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    this.records.set(next);
    this.persist();
  }

  private loadFromStorage(): StoredRecords {
    const parsed = this.storage.getJson<Record<string, PersonalRecord>>(STORAGE_KEY, {});
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }

    const next: StoredRecords = {};
    for (const [key, record] of Object.entries(parsed)) {
      if (VALID_RECORD_KEYS.has(key as GameRecordKey)) {
        next[key as GameRecordKey] = record;
      }
    }

    return next;
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.records());
  }

  private mergeRecord(
    existing: PersonalRecord | undefined,
    incoming: PersonalRecord,
  ): PersonalRecord {
    if (!existing) {
      return incoming;
    }

    const incomingIsBetter =
      incoming.bestPercent > existing.bestPercent ||
      (incoming.bestPercent === existing.bestPercent && incoming.bestScore > existing.bestScore);
    const bestSource = incomingIsBetter ? incoming : existing;

    return {
      bestScore: bestSource.bestScore,
      bestMaxScore: bestSource.bestMaxScore,
      bestPercent: bestSource.bestPercent,
      gamesPlayed: Math.max(existing.gamesPlayed, incoming.gamesPlayed),
      lastPlayedAt:
        Date.parse(incoming.lastPlayedAt) > Date.parse(existing.lastPlayedAt)
          ? incoming.lastPlayedAt
          : existing.lastPlayedAt,
      bestStreak: Math.max(existing.bestStreak ?? 0, incoming.bestStreak ?? 0),
    };
  }

  private recordsAreEqual(first: PersonalRecord, second: PersonalRecord): boolean {
    return (
      first.bestScore === second.bestScore &&
      first.bestMaxScore === second.bestMaxScore &&
      first.bestPercent === second.bestPercent &&
      first.gamesPlayed === second.gamesPlayed &&
      first.lastPlayedAt === second.lastPlayedAt &&
      (first.bestStreak ?? 0) === (second.bestStreak ?? 0)
    );
  }
}
