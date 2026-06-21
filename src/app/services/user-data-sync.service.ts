import { Injectable, effect, inject } from '@angular/core';
import { logger } from './logger.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GameRecordKey, PersonalRecord } from '../models/personal-record';
import { SpeedrunSplitBest, SpeedrunSplitId, SpeedrunUserRecord } from '../models/speedrun';
import { AchievementsService } from './achievements.service';
import { DailyChallengeService } from './daily-challenge.service';
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

type RemoteDailyChallengeXp = {
  source_id: string;
  awarded_at: string;
};

type RemoteProfileSyncState = {
  personal_records_reset_at: string | null;
};

@Injectable({ providedIn: 'root' })
export class UserDataSyncService {
  private readonly auth = inject(SupabaseAuthService);
  private readonly records = inject(PersonalRecordsService);
  private readonly achievements = inject(AchievementsService);
  private readonly dailyChallenges = inject(DailyChallengeService);
  private readonly speedrunRecords = inject(SpeedrunRecordsService);

  private initializedUserId: string | null = null;
  private isApplyingRemote = false;
  private uploadTimeoutId: number | null = null;
  private retryTimeoutId: number | null = null;
  private claimedDailyChallengeKeys = new Set<string>();
  private personalRecordsResetAt: string | null = null;

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;

      if (!userId) {
        this.initializedUserId = null;
        this.personalRecordsResetAt = null;
        this.claimedDailyChallengeKeys.clear();
        this.clearRetry();
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
      this.dailyChallenges.snapshot();

      if (!userId || this.initializedUserId !== userId || this.isApplyingRemote) {
        return;
      }

      this.scheduleUpload(userId);
    });
  }

  private async initialSync(userId: string): Promise<void> {
    this.initializedUserId = null;
    this.isApplyingRemote = true;
    this.claimedDailyChallengeKeys.clear();

    try {
      const client = await this.auth.getClient();
      await this.pullRemoteData(client, userId);
      this.isApplyingRemote = false;
      await this.uploadAll(client, userId);
      this.initializedUserId = userId;
    } catch (error) {
      this.isApplyingRemote = false;
      logger.warn('Unable to synchronize user data', error);
      this.scheduleRetry(userId);
    }
  }

  private async pullRemoteData(client: SupabaseClient, userId: string): Promise<void> {
    const [
      records,
      achievements,
      speedrunBest,
      speedrunSplitBests,
      dailyChallengeXp,
      profileSyncState,
    ] = await Promise.all([
      this.fetchRecords(client, userId),
      this.fetchAchievements(client, userId),
      this.fetchSpeedrunBest(client, userId),
      this.fetchSpeedrunSplitBests(client, userId),
      this.fetchDailyChallengeXp(client, userId),
      this.fetchProfileSyncState(client, userId),
    ]);

    this.personalRecordsResetAt = profileSyncState?.personal_records_reset_at ?? null;
    this.records.discardAtOrBefore(this.personalRecordsResetAt);
    this.records.mergeRecords(this.mapRemoteRecords(records));
    this.achievements.mergeUnlocks(this.mapRemoteAchievements(achievements));
    this.mergeRemoteDailyChallengeXp(dailyChallengeXp);
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
      logger.warn('Unable to upload user data', error);
    }
  }

  private async uploadAll(client: SupabaseClient, userId: string): Promise<void> {
    const results = await Promise.allSettled([
      this.syncRecords(client),
      this.syncAchievements(client, userId),
      this.syncDailyChallenges(client),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.warn('Unable to push user data:', this.describeError(result.reason));
      }
    }

    await this.syncAuthoritativeXp(client);
  }

  private async syncAuthoritativeXp(client: SupabaseClient): Promise<void> {
    const { error } = await client.rpc('sync_authoritative_xp_claims');

    if (error) {
      throw error;
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

  private async fetchProfileSyncState(
    client: SupabaseClient,
    userId: string,
  ): Promise<RemoteProfileSyncState | null> {
    const { data, error } = await client
      .from('user_profiles')
      .select('personal_records_reset_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as RemoteProfileSyncState | null;
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

  private async fetchDailyChallengeXp(
    client: SupabaseClient,
    userId: string,
  ): Promise<RemoteDailyChallengeXp[]> {
    const { data, error } = await client
      .from('xp_events')
      .select('source_id,awarded_at')
      .eq('user_id', userId)
      .eq('source_type', 'daily_challenge');

    if (error) {
      throw error;
    }

    return (data ?? []) as RemoteDailyChallengeXp[];
  }

  private async syncRecords(client: SupabaseClient): Promise<void> {
    const localRecords = Object.entries(this.records.snapshot())
      .filter((entry): entry is [GameRecordKey, PersonalRecord] => !!entry[1])
      .map(([recordKey, record]) => [recordKey, record] as const);
    const rows = localRecords.map(([recordKey, record]) => ({
      record_key: recordKey,
      best_score: record.bestScore,
      best_max_score: record.bestMaxScore,
      best_percent: record.bestPercent,
      games_played: record.gamesPlayed,
      last_played_at: record.lastPlayedAt,
      best_streak: record.bestStreak ?? 0,
    }));

    if (rows.length === 0) {
      return;
    }

    const { data, error } = await client.rpc('merge_personal_records', {
      p_records: rows,
    });

    if (error) {
      throw error;
    }

    this.isApplyingRemote = true;
    try {
      this.records.mergeRecords(this.mapRemoteRecords((data ?? []) as RemoteRecord[]));
    } finally {
      this.isApplyingRemote = false;
    }
  }

  async clearPersonalRecords(): Promise<void> {
    const userId = this.auth.user()?.id ?? null;
    if (!userId) {
      this.records.clearAll();
      return;
    }

    const client = await this.auth.getClient();
    const { data, error } = await client.rpc('reset_personal_records');

    if (error) {
      throw error;
    }

    this.isApplyingRemote = true;
    try {
      this.personalRecordsResetAt = typeof data === 'string' ? data : new Date().toISOString();
      this.records.clearAll();
    } finally {
      this.isApplyingRemote = false;
    }
  }

  private async syncAchievements(client: SupabaseClient, userId: string): Promise<void> {
    const localEntries = Object.entries(this.achievements.snapshot());
    const rows = localEntries.map(([achievementId, unlockedAt]) => ({
      user_id: userId,
      achievement_id: achievementId,
      unlocked_at: unlockedAt,
    }));

    await this.upsertRows(client, 'achievement_unlocks', rows, 'user_id,achievement_id');
  }

  private async syncDailyChallenges(client: SupabaseClient): Promise<void> {
    const dateKeys = Object.keys(this.dailyChallenges.snapshot()).filter(
      (dateKey) => !this.claimedDailyChallengeKeys.has(dateKey),
    );

    for (const dateKey of dateKeys) {
      const { error } = await client.rpc('claim_daily_challenge_xp', {
        p_date: dateKey,
      });

      if (error) {
        throw error;
      }

      this.claimedDailyChallengeKeys.add(dateKey);
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

  private mergeRemoteDailyChallengeXp(events: RemoteDailyChallengeXp[]): void {
    const completions: Record<string, string> = {};

    for (const event of events) {
      const dateKey = event.source_id.replace(/^daily-challenge:/, '');
      if (dateKey === event.source_id) {
        continue;
      }

      completions[dateKey] = event.awarded_at;
      this.claimedDailyChallengeKeys.add(dateKey);
    }

    this.dailyChallenges.mergeRemoteCompletions(completions);
  }

  private scheduleRetry(userId: string): void {
    this.clearRetry();

    if (typeof window === 'undefined') {
      return;
    }

    this.retryTimeoutId = window.setTimeout(() => {
      this.retryTimeoutId = null;
      if (this.auth.user()?.id === userId && this.initializedUserId !== userId) {
        void this.initialSync(userId);
      }
    }, 5_000);
  }

  private clearRetry(): void {
    if (this.retryTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.retryTimeoutId);
    }

    this.retryTimeoutId = null;
  }

  private describeError(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    return String(error);
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
