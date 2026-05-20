import { Injectable, computed, inject, signal } from '@angular/core';
import { SUPABASE_CLIENT_LOADER } from './supabase-client';

export type SpeedrunLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
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
  avatar_url: string | null;
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
          'user_id,display_name,avatar_url,total_time_ms,raw_time_ms,penalty_ms,mistake_count,correct_count,completed_at',
        )
        .order('total_time_ms', { ascending: true })
        .order('completed_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      this.entriesState.set(this.mapEntries((data ?? []) as RemoteLeaderboardEntry[]));
    } catch (error) {
      this.errorState.set(error instanceof Error ? error.message : 'Unable to load leaderboard');
      this.entriesState.set([]);
    } finally {
      this.loadingState.set(false);
    }
  }

  private mapEntries(entries: RemoteLeaderboardEntry[]): SpeedrunLeaderboardEntry[] {
    return entries.map((entry) => ({
      userId: entry.user_id,
      displayName: entry.display_name || 'Joueur',
      avatarUrl: entry.avatar_url,
      totalTimeMs: entry.total_time_ms,
      rawTimeMs: entry.raw_time_ms,
      penaltyMs: entry.penalty_ms,
      mistakeCount: entry.mistake_count,
      correctCount: entry.correct_count,
      completedAt: entry.completed_at,
    }));
  }
}
