import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AchievementsService } from './achievements.service';
import { PersonalRecordsService } from './personal-records.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { UserDataSyncService } from './user-data-sync.service';

type QueryCall =
  | { type: 'delete'; table: string; column: string; values: string[] }
  | {
      type: 'upsert';
      table: string;
      rows: Record<string, unknown>[];
      options: { onConflict: string };
    };

describe('UserDataSyncService', () => {
  it('syncs user data without deleting every remote row first', async () => {
    const calls: QueryCall[] = [];
    const client = createClientStub(
      {
        personal_records: [{ record_key: 'country-to-flag-hard' }],
        achievement_unlocks: [{ achievement_id: 'twenty-runs' }],
        speedrun_leaderboard: [],
        speedrun_split_bests: [],
      },
      calls,
    );

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
          },
        },
      ],
    });
    const service = TestBed.inject(UserDataSyncService) as unknown as {
      uploadAll(client: SupabaseClient, userId: string): Promise<void>;
    };

    await service.uploadAll(client, 'user-1');

    expect(calls).toContainEqual({
      type: 'delete',
      table: 'personal_records',
      column: 'record_key',
      values: ['country-to-flag-hard'],
    });
    expect(calls).toContainEqual(
      expect.objectContaining({
        type: 'upsert',
        table: 'personal_records',
        options: { onConflict: 'user_id,record_key' },
      }),
    );
    expect(calls).toContainEqual({
      type: 'delete',
      table: 'achievement_unlocks',
      column: 'achievement_id',
      values: ['twenty-runs'],
    });
    expect(calls).toContainEqual(
      expect.objectContaining({
        type: 'upsert',
        table: 'achievement_unlocks',
        options: { onConflict: 'user_id,achievement_id' },
      }),
    );
  });
});

function createClientStub(
  dataByTable: Record<string, Record<string, unknown>[]>,
  calls: QueryCall[],
): SupabaseClient {
  return {
    from(table: string) {
      return {
        select: () => ({
          eq: () => createSelectResult(dataByTable[table] ?? []),
        }),
        delete: () => ({
          eq: () => ({
            in: async (column: string, values: string[]) => {
              calls.push({ type: 'delete', table, column, values });
              return { error: null };
            },
          }),
        }),
        upsert: async (rows: Record<string, unknown>[], options: { onConflict: string }) => {
          calls.push({ type: 'upsert', table, rows, options });
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function createSelectResult(rows: Record<string, unknown>[]) {
  const result = { data: rows, error: null };

  return {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
  };
}
