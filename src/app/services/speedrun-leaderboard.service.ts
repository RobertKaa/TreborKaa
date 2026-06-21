import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_PROFILE_AVATAR_KEY,
  buildDefaultPublicDisplayName,
  readProfileAvatarKey,
  sanitizeProfileDisplayName,
} from '../utils/profile-safety';
import type { ProfileAvatarKey } from '../utils/profile-safety';
import { SUPABASE_CLIENT_LOADER } from './supabase-client';

export type SpeedrunLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarKey: ProfileAvatarKey;
  totalTimeMs: number;
  rawTimeMs: number;
  penaltyMs: number;
  mistakeCount: number;
  correctCount: number;
  completedAt: string;
};

type RemoteLeaderboardEntry = {
  user_id: string;
  display_name: string | null;
  avatar_key: string | null;
  total_time_ms: number;
  raw_time_ms: number;
  penalty_ms: number;
  mistake_count: number;
  correct_count: number;
  completed_at: string;
};

@Injectable({ providedIn: 'root' })
export class SpeedrunLeaderboardService {
  private readonly loadClient = inject(SUPABASE_CLIENT_LOADER);
  private readonly entriesState = signal<SpeedrunLeaderboardEntry[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly entries = this.entriesState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasEntries = computed(() => this.entriesState().length > 0);

  async refresh(limit = 50): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const client = await this.loadClient();
      const { data, error } = await client
        .from('speedrun_leaderboard')
        .select(
          'user_id,display_name,avatar_key,total_time_ms,raw_time_ms,penalty_ms,mistake_count,correct_count,completed_at',
        )
        .order('total_time_ms', { ascending: true })
        .order('completed_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      this.entriesState.set(this.mapEntries((data ?? []) as RemoteLeaderboardEntry[]));
    } catch (error) {
      this.errorState.set(readLeaderboardErrorMessage(error));
      this.entriesState.set([]);
    } finally {
      this.loadingState.set(false);
    }
  }

  private mapEntries(entries: RemoteLeaderboardEntry[]): SpeedrunLeaderboardEntry[] {
    return entries.map((entry) => ({
      userId: entry.user_id,
      displayName:
        sanitizeProfileDisplayName(entry.display_name) ?? buildDefaultPublicDisplayName(entry.user_id),
      avatarKey: readProfileAvatarKey(entry.avatar_key ?? DEFAULT_PROFILE_AVATAR_KEY),
      totalTimeMs: entry.total_time_ms,
      rawTimeMs: entry.raw_time_ms,
      penaltyMs: entry.penalty_ms,
      mistakeCount: entry.mistake_count,
      correctCount: entry.correct_count,
      completedAt: entry.completed_at,
    }));
  }

}

function readLeaderboardErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Unable to load leaderboard';
}
