import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AchievementsService } from './achievements.service';
import { DailyChallengeService } from './daily-challenge.service';
import { PersonalRecordsService } from './personal-records.service';
import { SpeedrunRecordsService } from './speedrun-records.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { UserDataSyncService } from './user-data-sync.service';

type QueryCall =
  | {
      type: 'upsert';
      table: string;
      rows: Record<string, unknown>[];
      options: { onConflict: string };
    }
  | { type: 'rpc'; name: string; parameters: Record<string, unknown> | undefined };

describe('UserDataSyncService', () => {
  it('merges records atomically and only adds monotonic user data', async () => {
    const calls: QueryCall[] = [];
    const client = createClientStub(calls);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseAuthService,
          useValue: {
            user: signal(null),
            getClient: vi.fn().mockResolvedValue(client),
          },
        },
        {
          provide: PersonalRecordsService,
          useValue: {
            snapshot: signal({
              'country-to-flag-easy': {
                bestScore: 8,
                bestMaxScore: 10,
                bestPercent: 80,
                gamesPlayed: 3,
                lastPlayedAt: '2026-05-19T18:00:00.000Z',
                bestStreak: 4,
              },
            }),
            mergeRecords: vi.fn(),
          },
        },
        {
          provide: AchievementsService,
          useValue: {
            snapshot: signal({
              'first-game': '2026-05-19T18:00:00.000Z',
            }),
            mergeUnlocks: vi.fn(),
            setAuthoritativeXpTotal: vi.fn(),
            clearAuthoritativeXpTotal: vi.fn(),
            resolveXpDisplayWithoutServer: vi.fn(),
          },
        },
        {
          provide: DailyChallengeService,
          useValue: {
            snapshot: signal({
              '2026-06-11': '2026-06-11T08:00:00.000Z',
            }),
            mergeRemoteCompletions: vi.fn(),
          },
        },
        {
          provide: SpeedrunRecordsService,
          useValue: {
            mergeBestForUser: vi.fn(),
            mergeSplitBestsForUser: vi.fn(),
          },
        },
      ],
    });
    const service = TestBed.inject(UserDataSyncService) as unknown as {
      uploadAll(client: SupabaseClient, userId: string): Promise<void>;
    };

    await service.uploadAll(client, 'user-1');

    expect(calls).toContainEqual({
      type: 'rpc',
      name: 'merge_personal_records',
      parameters: {
        p_records: [
          {
            record_key: 'country-to-flag-easy',
            best_score: 8,
            best_max_score: 10,
            best_percent: 80,
            games_played: 3,
            last_played_at: '2026-05-19T18:00:00.000Z',
            best_streak: 4,
          },
        ],
      },
    });
    expect(calls).toContainEqual(
      expect.objectContaining({
        type: 'upsert',
        table: 'achievement_unlocks',
        options: { onConflict: 'user_id,achievement_id' },
      }),
    );
    expect(calls).toContainEqual({
      type: 'rpc',
      name: 'claim_daily_challenge_xp',
      parameters: { p_date: '2026-06-11' },
    });
    expect(calls).toContainEqual({
      type: 'rpc',
      name: 'sync_authoritative_xp_claims',
      parameters: undefined,
    });
    expect(calls.some((call) => 'table' in call && call.table === 'personal_records')).toBe(false);
  });

  it('refreshes authoritative xp total after syncing claims', async () => {
    const calls: QueryCall[] = [];
    const client = createClientStub(calls, {
      xpEvents: [{ amount: 120 }, { amount: 80 }],
    });
    const setAuthoritativeXpTotal = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseAuthService,
          useValue: {
            user: signal(null),
            getClient: vi.fn().mockResolvedValue(client),
          },
        },
        {
          provide: PersonalRecordsService,
          useValue: {
            snapshot: signal({}),
            mergeRecords: vi.fn(),
          },
        },
        {
          provide: AchievementsService,
          useValue: {
            snapshot: signal({}),
            mergeUnlocks: vi.fn(),
            setAuthoritativeXpTotal,
            clearAuthoritativeXpTotal: vi.fn(),
            resolveXpDisplayWithoutServer: vi.fn(),
          },
        },
        {
          provide: DailyChallengeService,
          useValue: {
            snapshot: signal({}),
            mergeRemoteCompletions: vi.fn(),
          },
        },
        {
          provide: SpeedrunRecordsService,
          useValue: {
            mergeBestForUser: vi.fn(),
            mergeSplitBestsForUser: vi.fn(),
          },
        },
      ],
    });
    const service = TestBed.inject(UserDataSyncService) as unknown as {
      uploadAll(client: SupabaseClient, userId: string): Promise<void>;
    };

    await service.uploadAll(client, 'user-1');

    expect(setAuthoritativeXpTotal).toHaveBeenCalledWith(200);
  });

  it('resets remote records before clearing the local snapshot', async () => {
    const calls: QueryCall[] = [];
    const client = createClientStub(calls, { rpcData: '2026-06-11T10:00:00.000Z' });
    const user = signal<{ id: string } | null>(null);
    const clearAll = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseAuthService,
          useValue: {
            user,
            getClient: vi.fn().mockResolvedValue(client),
          },
        },
        {
          provide: PersonalRecordsService,
          useValue: {
            snapshot: signal({}),
            mergeRecords: vi.fn(),
            discardAtOrBefore: vi.fn(),
            clearAll,
          },
        },
        {
          provide: AchievementsService,
          useValue: {
            snapshot: signal({}),
            mergeUnlocks: vi.fn(),
            clearAuthoritativeXpTotal: vi.fn(),
            resolveXpDisplayWithoutServer: vi.fn(),
          },
        },
        {
          provide: DailyChallengeService,
          useValue: {
            snapshot: signal({}),
            mergeRemoteCompletions: vi.fn(),
          },
        },
        {
          provide: SpeedrunRecordsService,
          useValue: {
            mergeBestForUser: vi.fn(),
            mergeSplitBestsForUser: vi.fn(),
          },
        },
      ],
    });
    const service = TestBed.inject(UserDataSyncService);
    user.set({ id: 'user-1' });

    await service.clearPersonalRecords();

    expect(calls).toContainEqual({
      type: 'rpc',
      name: 'reset_personal_records',
      parameters: undefined,
    });
    expect(clearAll).toHaveBeenCalledOnce();
  });
});

type ClientStubOptions = {
  rpcData?: unknown;
  xpEvents?: Array<{ amount: number }>;
};

function createClientStub(
  calls: QueryCall[],
  options: ClientStubOptions | unknown = {},
): SupabaseClient {
  const config: ClientStubOptions =
    options !== null && typeof options === 'object' && !Array.isArray(options)
      ? (options as ClientStubOptions)
      : { rpcData: options };
  const rpcData = config.rpcData ?? [];
  const xpEvents = config.xpEvents ?? [];

  const createFilterBuilder = (data: unknown) => ({
    eq: () => Promise.resolve({ data, error: null }),
    maybeSingle: () => Promise.resolve({ data, error: null }),
  });

  return {
    from(table: string) {
      return {
        select: () => createFilterBuilder(table === 'xp_events' ? xpEvents : rpcData),
        upsert: async (rows: Record<string, unknown>[], options: { onConflict: string }) => {
          calls.push({ type: 'upsert', table, rows, options });
          return { error: null };
        },
      };
    },
    rpc: async (name: string, parameters?: Record<string, unknown>) => {
      calls.push({ type: 'rpc', name, parameters });
      return { data: rpcData, error: null };
    },
  } as unknown as SupabaseClient;
}
