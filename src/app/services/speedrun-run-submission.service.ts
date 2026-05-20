import { Injectable, inject } from '@angular/core';
import { SpeedrunRunResult, SpeedrunSplit } from '../models/speedrun';
import { SupabaseAuthService } from './supabase-auth.service';

export type SpeedrunAttempt = {
  attemptId: string;
  seed: string;
  splits: SpeedrunSplit[];
  startedAt: string;
};

export type SpeedrunSubmissionResult = {
  accepted: boolean;
  totalTimeMs: number;
  rawTimeMs: number;
  penaltyMs: number;
  mistakeCount: number;
  correctCount: number;
};

@Injectable({ providedIn: 'root' })
export class SpeedrunRunSubmissionService {
  private readonly auth = inject(SupabaseAuthService);

  async startAttempt(): Promise<SpeedrunAttempt> {
    const client = await this.auth.getClient();
    const { data, error } = await client.functions.invoke('speedrun-start', {
      body: { version: 2 },
    });

    if (error) {
      throw error;
    }

    return this.mapAttempt(data);
  }

  async submitAttempt(
    attemptId: string,
    result: SpeedrunRunResult,
    metadata: Record<string, unknown>,
  ): Promise<SpeedrunSubmissionResult> {
    const client = await this.auth.getClient();
    const { data, error } = await client.functions.invoke('speedrun-submit', {
      body: {
        attemptId,
        rawTimeMs: result.rawTimeMs,
        mistakeCount: result.mistakeCount,
        metadata,
      },
    });

    if (error) {
      throw error;
    }

    return this.mapSubmission(data);
  }

  private mapAttempt(data: unknown): SpeedrunAttempt {
    const attempt = data as (Partial<SpeedrunAttempt> & { steps?: SpeedrunSplit[] }) | null;

    if (
      !attempt ||
      typeof attempt.attemptId !== 'string' ||
      typeof attempt.seed !== 'string' ||
      typeof attempt.startedAt !== 'string' ||
      !Array.isArray(attempt.splits ?? attempt.steps)
    ) {
      throw new Error('Invalid speedrun attempt response');
    }

    return {
      attemptId: attempt.attemptId,
      seed: attempt.seed,
      startedAt: attempt.startedAt,
      splits: (attempt.splits ?? attempt.steps) as SpeedrunSplit[],
    };
  }

  private mapSubmission(data: unknown): SpeedrunSubmissionResult {
    const submission = data as Partial<SpeedrunSubmissionResult> | null;

    if (!submission || submission.accepted !== true) {
      throw new Error('Invalid speedrun submission response');
    }

    return {
      accepted: true,
      totalTimeMs: this.readFiniteNumber(submission.totalTimeMs),
      rawTimeMs: this.readFiniteNumber(submission.rawTimeMs),
      penaltyMs: this.readFiniteNumber(submission.penaltyMs),
      mistakeCount: this.readFiniteNumber(submission.mistakeCount),
      correctCount: this.readFiniteNumber(submission.correctCount),
    };
  }

  private readFiniteNumber(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Invalid speedrun submission response');
    }

    return value;
  }
}
