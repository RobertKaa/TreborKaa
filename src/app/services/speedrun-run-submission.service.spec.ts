import { TestBed } from '@angular/core/testing';
import { buildSpeedrunResult } from '../models/speedrun';
import { SupabaseAuthService } from './supabase-auth.service';
import { SpeedrunRunSubmissionService } from './speedrun-run-submission.service';
import { vi } from 'vitest';

describe('SpeedrunRunSubmissionService', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    invoke.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseAuthService,
          useValue: {
            getClient: vi.fn().mockResolvedValue({
              functions: { invoke },
            }),
          },
        },
      ],
    });
  });

  it('starts a server attempt through the Edge Function', async () => {
    invoke.mockResolvedValue({
      data: {
        attemptId: 'attempt-id',
        seed: 'seed',
        splits: [
          {
            id: 'country-to-flag-hard',
            order: 1,
            mode: 'country-to-flag',
            difficulty: 'hard',
            labelKey: 'speedrun.split.countryToFlagHard',
            questionCount: 15,
          },
        ],
        startedAt: '2026-05-20T10:00:00.000Z',
      },
      error: null,
    });

    const service = TestBed.inject(SpeedrunRunSubmissionService);
    const attempt = await service.startAttempt();

    expect(invoke).toHaveBeenCalledWith('speedrun-start', { body: { version: 2 } });
    expect(attempt.attemptId).toBe('attempt-id');
  });

  it('submits the raw time and mistake count only through the Edge Function', async () => {
    invoke.mockResolvedValue({
      data: {
        accepted: true,
        totalTimeMs: 72_000,
        rawTimeMs: 42_000,
        penaltyMs: 30_000,
        mistakeCount: 1,
        correctCount: 5,
      },
      error: null,
    });

    const service = TestBed.inject(SpeedrunRunSubmissionService);
    const result = buildSpeedrunResult(42_000, 1, '2026-05-20T10:01:00.000Z');
    const submission = await service.submitAttempt('attempt-id', result, { version: 1 });

    expect(invoke).toHaveBeenCalledWith('speedrun-submit', {
      body: {
        attemptId: 'attempt-id',
        rawTimeMs: 42_000,
        mistakeCount: 1,
        metadata: { version: 1 },
      },
    });
    expect(submission.accepted).toBe(true);
  });
});
