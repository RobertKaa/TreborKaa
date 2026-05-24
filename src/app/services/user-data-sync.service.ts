import { Injectable, effect, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GameRecordKey, PersonalRecord } from '../models/personal-record';
import { SpeedrunSplitBest, SpeedrunSplitId, SpeedrunUserRecord } from '../models/speedrun';
import { AchievementsService } from './achievements.service';
import { PersonalRecordsService } from './personal-records.service';
import { SpeedrunRecordsService } from './speedrun-records.service';
import { SupabaseAuthService } from './supabase-auth.service';

type RemoteRecord = {
  record_key: string;
  best_score: number;
  best_max_score: number;
  best_percent: number;
  games_played: number;
  last_played_at: string;
  best_streak: number | null;
};

type RemoteAchievement = {
  achievement_id: string;
  unlocked_at: string;
};

type RemoteSpeedrunBest = {
  user_id: string;
  total_time_ms: number;
  raw_time_ms: number;
  penalty_ms: number;
  mistake_count: number;
  correct_count: number;
  completed_at: string;
};

type RemoteSpeedrunSplitBest = {
  split_id: string;
  total_time_ms: number;
  raw_time_ms: number;
  penalty_ms: number;
  mistake_count: number;
  completed_at: string;
};

@Injectable({ providedIn: 'root' })
export class UserDataSyncService {
  private readonly auth = inject(SupabaseAuthService);
  private readonly records = inject(PersonalRecordsService);
  private readonly achievements = inject(AchievementsService);
  private readonly speedrunRecords = inject(SpeedrunRecordsService);

  private initializedUserId: string | null = null;
  private isApplyingRemote = false;
  private uploadTimeoutId: number | null = null;

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;

      if (!userId) {
        this.initializedUserId = null;
        return;
      }

      if (this.initializedUserId !== userId) {
        void this.initialSync(userId);
      }
    });

    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      this.records.snapshot();
      this.achievements.snapshot();

      if (!userId || this.initializedUserId !== userId || this.isApplyingRemote) {
        return;
      }

      this.scheduleUpload(userId);
    });
  }

  private async initialSync(userId: string): Promise<void> {
    this.initializedUserId = null;
    this.isApplyingRemote = true;

    try {
      const client = await this.auth.getClient();
      await this.pullRemoteData(client, userId);
      this.isApplyingRemote = false;
      await this.uploadAll(client, userId);
      this.initializedUserId = userId;
    } catch (error) {
      this.isApplyingRemote = false;
      this.initializedUserId = userId;
      console.warn('Unable to synchronize user data', error);
    }
  }

  private async pullRemoteData(client: SupabaseClient, userId: string): Promise<void> {
    const [records, achievements, speedrunBest, speedrunSplitBests] = await Promise.all([
      this.safeFetch(() => this.fetchRecords(client, userId), []),
      this.safeFetch(() => this.fetchAchievements(client, userId), []),
      this.safeFetch(() => this.fetchSpeedrunBest(client, userId), null),
      this.safeFetch(() => this.fetchSpeedrunSplitBests(client, userId), []),
    ]);

    this.records.mergeRecords(this.mapRemoteRecords(records));
    this.achievements.mergeUnlocks(this.mapRemoteAchievements(achievements));
    this.speedrunRecords.mergeBestForUser(userId, this.mapRemoteSpeedrunBest(userId, speedrunBest));
    this.speedrunRecords.mergeSplitBestsForUser(
      userId,
      this.mapRemoteSpeedrunSplitBests(speedrunSplitBests),
    );
  }

  private scheduleUpload(userId: string): void {
    if (typeof window === 'undefined') {
      void this.uploadForCurrentUser(userId);
      return;
    }

    if (this.uploadTimeoutId !== null) {
      window.clearTimeout(this.uploadTimeoutId);
    }

    this.uploadTimeoutId = window.setTimeout(() => {
      this.uploadTimeoutId = null;
      void this.uploadForCurrentUser(userId);
    }, 350);
  }

  private async uploadForCurrentUser(userId: string): Promise<void> {
    try {
      const client = await this.auth.getClient();
      await this.uploadAll(client, userId);
    } catch (error) {
      console.warn('Unable to upload user data', error);
    }
  }

  private async uploadAll(client: SupabaseClient, userId: string): Promise<void> {
    const results = await Promise.allSettled([
      this.syncRecords(client, userId),
      this.syncAchievements(client, userId),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('Unable to push user data', result.reason);
      }
    }
  }

  private async fetchRecords(client: SupabaseClient, userId: string): Promise<RemoteRecord[]> {
    const { data, error } = await client
      .from('personal_records')
      .select(
        'record_key,best_score,best_max_score,best_percent,games_played,last_played_at,best_streak',
      )
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return (data ?? []) as RemoteRecord[];
  }

  private async fetchAchievements(
    client: SupabaseClient,
    userId: string,
  ): Promise<RemoteAchievement[]> {
    const { data, error } = await client
      .from('achievement_unlocks')
      .select('achievement_id,unlocked_at')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return (data ?? []) as RemoteAchievement[];
  }

  private async fetchSpeedrunBest(
    client: SupabaseClient,
    userId: string,
  ): Promise<RemoteSpeedrunBest | null> {
    const { data, error } = await client
      .from('speedrun_leaderboard')
      .select(
        'user_id,total_time_ms,raw_time_ms,penalty_ms,mistake_count,correct_count,completed_at',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as RemoteSpeedrunBest | null;
  }

  private async fetchSpeedrunSplitBests(
    client: SupabaseClient,
    userId: string,
  ): Promise<RemoteSpeedrunSplitBest[]> {
    const { data, error } = await client
      .from('speedrun_split_bests')
      .select('split_id,total_time_ms,raw_time_ms,penalty_ms,mistake_count,completed_at')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return (data ?? []) as RemoteSpeedrunSplitBest[];
  }

  private async syncRecords(client: SupabaseClient, userId: string): Promise<void> {
    const remoteRecords = await this.safeFetch(() => this.fetchRecords(client, userId), []);
    const localRecords = Object.entries(this.records.snapshot())
      .filter((entry): entry is [GameRecordKey, PersonalRecord] => !!entry[1])
      .map(([recordKey, record]) => [recordKey, record] as const);
    const localKeys = new Set(localRecords.map(([recordKey]) => recordKey));
    const staleKeys = remoteRecords
      .map((record) => record.record_key)
      .filter((recordKey) => !localKeys.has(recordKey as GameRecordKey));
    const rows = localRecords.map(([recordKey, record]) => ({
      user_id: userId,
      record_key: recordKey,
      best_score: record.bestScore,
      best_max_score: record.bestMaxScore,
      best_percent: record.bestPercent,
      games_played: record.gamesPlayed,
      last_played_at: record.lastPlayedAt,
      best_streak: record.bestStreak ?? 0,
    }));

    await this.deleteRowsByValues(client, 'personal_records', userId, 'record_key', staleKeys);
    await this.upsertRows(client, 'personal_records', rows, 'user_id,record_key');
  }

  private async syncAchievements(client: SupabaseClient, userId: string): Promise<void> {
    const remoteAchievements = await this.safeFetch(
      () => this.fetchAchievements(client, userId),
      [],
    );
    const localEntries = Object.entries(this.achievements.snapshot());
    const localIds = new Set(localEntries.map(([achievementId]) => achievementId));
    const staleIds = remoteAchievements
      .map((achievement) => achievement.achievement_id)
      .filter((achievementId) => !localIds.has(achievementId));
    const rows = localEntries.map(([achievementId, unlockedAt]) => ({
      user_id: userId,
      achievement_id: achievementId,
      unlocked_at: unlockedAt,
    }));

    await this.deleteRowsByValues(
      client,
      'achievement_unlocks',
      userId,
      'achievement_id',
      staleIds,
    );
    await this.upsertRows(client, 'achievement_unlocks', rows, 'user_id,achievement_id');
  }

  private async deleteRowsByValues(
    client: SupabaseClient,
    table: string,
    userId: string,
    column: string,
    values: string[],
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }

    const { error } = await client.from(table).delete().eq('user_id', userId).in(column, values);

    if (error) {
      throw error;
    }
  }

  private async upsertRows(
    client: SupabaseClient,
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const { error } = await client.from(table).upsert(rows, { onConflict });

    if (error) {
      throw error;
    }
  }

  private async safeFetch<T>(fetchData: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fetchData();
    } catch (error) {
      console.warn('Unable to pull remote user data', error);
      return fallback;
    }
  }

  private mapRemoteRecords(
    records: RemoteRecord[],
  ): Partial<Record<GameRecordKey, PersonalRecord>> {
    const next: Partial<Record<GameRecordKey, PersonalRecord>> = {};

    for (const record of records) {
      next[record.record_key as GameRecordKey] = {
        bestScore: record.best_score,
        bestMaxScore: record.best_max_score,
        bestPercent: record.best_percent,
        gamesPlayed: record.games_played,
        lastPlayedAt: record.last_played_at,
        bestStreak: record.best_streak ?? 0,
      };
    }

    return next;
  }

  private mapRemoteAchievements(
    achievements: RemoteAchievement[],
  ): Partial<Record<string, string>> {
    const next: Partial<Record<string, string>> = {};

    for (const achievement of achievements) {
      next[achievement.achievement_id] = achievement.unlocked_at;
    }

    return next;
  }

  private mapRemoteSpeedrunBest(
    userId: string,
    record: RemoteSpeedrunBest | null,
  ): SpeedrunUserRecord | null {
    if (!record) {
      return null;
    }

    return {
      userId,
      totalTimeMs: record.total_time_ms,
      rawTimeMs: record.raw_time_ms,
      penaltyMs: record.penalty_ms,
      mistakeCount: record.mistake_count,
      correctCount: record.correct_count,
      completedAt: record.completed_at,
    };
  }

  private mapRemoteSpeedrunSplitBests(records: RemoteSpeedrunSplitBest[]): SpeedrunSplitBest[] {
    return records.map((record) => ({
      splitId: record.split_id as SpeedrunSplitId,
      totalTimeMs: record.total_time_ms,
      rawTimeMs: record.raw_time_ms,
      penaltyMs: record.penalty_ms,
      mistakeCount: record.mistake_count,
      completedAt: record.completed_at,
    }));
  }
}
