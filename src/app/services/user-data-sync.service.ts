import { Injectable, effect, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GameRecordKey, PersonalRecord } from '../models/personal-record';
import { AchievementsService } from './achievements.service';
import { FavoriteGamesService } from './favorite-games.service';
import { PersonalRecordsService } from './personal-records.service';
import { SupabaseAuthService } from './supabase-auth.service';

type RemoteFavorite = {
  game_id: string;
};

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

@Injectable({ providedIn: 'root' })
export class UserDataSyncService {
  private readonly auth = inject(SupabaseAuthService);
  private readonly favorites = inject(FavoriteGamesService);
  private readonly records = inject(PersonalRecordsService);
  private readonly achievements = inject(AchievementsService);

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
      this.favorites.snapshot();
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
    const [favorites, records, achievements] = await Promise.all([
      this.safeFetch(() => this.fetchFavorites(client, userId), []),
      this.safeFetch(() => this.fetchRecords(client, userId), []),
      this.safeFetch(() => this.fetchAchievements(client, userId), []),
    ]);

    this.favorites.mergeFavorites(favorites.map((favorite) => favorite.game_id));
    this.records.mergeRecords(this.mapRemoteRecords(records));
    this.achievements.mergeUnlocks(this.mapRemoteAchievements(achievements));
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
      this.replaceFavorites(client, userId),
      this.replaceRecords(client, userId),
      this.replaceAchievements(client, userId),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('Unable to push user data', result.reason);
      }
    }
  }

  private async fetchFavorites(client: SupabaseClient, userId: string): Promise<RemoteFavorite[]> {
    const { data, error } = await client
      .from('favorite_games')
      .select('game_id')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return (data ?? []) as RemoteFavorite[];
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

  private async replaceFavorites(client: SupabaseClient, userId: string): Promise<void> {
    await this.deleteUserRows(client, 'favorite_games', userId);

    const rows = this.favorites.ids().map((gameId) => ({
      user_id: userId,
      game_id: gameId,
    }));

    await this.insertRows(client, 'favorite_games', rows);
  }

  private async replaceRecords(client: SupabaseClient, userId: string): Promise<void> {
    await this.deleteUserRows(client, 'personal_records', userId);

    const rows = Object.entries(this.records.snapshot())
      .filter((entry): entry is [GameRecordKey, PersonalRecord] => !!entry[1])
      .map(([recordKey, record]) => ({
        user_id: userId,
        record_key: recordKey,
        best_score: record.bestScore,
        best_max_score: record.bestMaxScore,
        best_percent: record.bestPercent,
        games_played: record.gamesPlayed,
        last_played_at: record.lastPlayedAt,
        best_streak: record.bestStreak ?? 0,
      }));

    await this.insertRows(client, 'personal_records', rows);
  }

  private async replaceAchievements(client: SupabaseClient, userId: string): Promise<void> {
    await this.deleteUserRows(client, 'achievement_unlocks', userId);

    const rows = Object.entries(this.achievements.snapshot()).map(
      ([achievementId, unlockedAt]) => ({
        user_id: userId,
        achievement_id: achievementId,
        unlocked_at: unlockedAt,
      }),
    );

    await this.insertRows(client, 'achievement_unlocks', rows);
  }

  private async deleteUserRows(
    client: SupabaseClient,
    table: string,
    userId: string,
  ): Promise<void> {
    const { error } = await client.from(table).delete().eq('user_id', userId);

    if (error) {
      throw error;
    }
  }

  private async insertRows(
    client: SupabaseClient,
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const { error } = await client.from(table).insert(rows);

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
}
