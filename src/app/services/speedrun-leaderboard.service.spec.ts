import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { SpeedrunLeaderboardService } from './speedrun-leaderboard.service';
import { SUPABASE_CLIENT_LOADER } from './supabase-client';

describe('SpeedrunLeaderboardService', () => {
  const limit = vi.fn();
  const orderCompletedAt = vi.fn(() => ({ limit }));
  const orderTotalTime = vi.fn(() => ({ order: orderCompletedAt }));
  const select = vi.fn(() => ({ order: orderTotalTime }));
  const from = vi.fn(() => ({ select }));

  beforeEach(() => {
    limit.mockReset();
    orderCompletedAt.mockReset().mockReturnValue({ limit });
    orderTotalTime.mockReset().mockReturnValue({ order: orderCompletedAt });
    select.mockReset().mockReturnValue({ order: orderTotalTime });
    from.mockReset().mockReturnValue({ select });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPABASE_CLIENT_LOADER,
          useValue: async () =>
            ({
              from,
            }) as unknown as SupabaseClient,
        },
      ],
    });
  });

  it('maps remote leaderboard rows with avatar_key and sanitized display names', async () => {
    limit.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          display_name: 'Capitaine Bleu',
          avatar_key: 'jp',
          total_time_ms: 72_000,
          raw_time_ms: 42_000,
          penalty_ms: 30_000,
          mistake_count: 1,
          correct_count: 59,
          completed_at: '2026-05-20T10:01:00.000Z',
        },
      ],
      error: null,
    });

    const service = TestBed.inject(SpeedrunLeaderboardService);
    await service.refresh();

    expect(from).toHaveBeenCalledWith('speedrun_leaderboard');
    expect(select).toHaveBeenCalledWith(
      'user_id,display_name,avatar_key,total_time_ms,raw_time_ms,penalty_ms,mistake_count,correct_count,completed_at',
    );
    expect(service.entries()).toEqual([
      {
        userId: 'user-1',
        displayName: 'Capitaine Bleu',
        avatarKey: 'jp',
        totalTimeMs: 72_000,
        rawTimeMs: 42_000,
        penaltyMs: 30_000,
        mistakeCount: 1,
        correctCount: 59,
        completedAt: '2026-05-20T10:01:00.000Z',
      },
    ]);
    expect(service.error()).toBeNull();
    expect(service.isLoading()).toBe(false);
  });

  it('falls back to a safe default flag when avatar_key is missing or invalid', async () => {
    limit.mockResolvedValue({
      data: [
        {
          user_id: 'user-2',
          display_name: null,
          avatar_key: 'INVALID',
          total_time_ms: 80_000,
          raw_time_ms: 50_000,
          penalty_ms: 30_000,
          mistake_count: 1,
          correct_count: 59,
          completed_at: '2026-05-20T10:02:00.000Z',
        },
      ],
      error: null,
    });

    const service = TestBed.inject(SpeedrunLeaderboardService);
    await service.refresh();

    expect(service.entries()[0]?.avatarKey).toBe('fr');
    expect(service.entries()[0]?.displayName).toBe('Joueur USER2');
  });

  it('maps legacy avatar keys to country flag codes', async () => {
    limit.mockResolvedValue({
      data: [
        {
          user_id: 'user-3',
          display_name: 'Joueur USER3',
          avatar_key: 'bolt',
          total_time_ms: 90_000,
          raw_time_ms: 60_000,
          penalty_ms: 30_000,
          mistake_count: 1,
          correct_count: 59,
          completed_at: '2026-05-20T10:03:00.000Z',
        },
      ],
      error: null,
    });

    const service = TestBed.inject(SpeedrunLeaderboardService);
    await service.refresh();

    expect(service.entries()[0]?.avatarKey).toBe('jp');
  });

  it('clears entries and stores an error when the fetch fails', async () => {
    limit.mockResolvedValue({
      data: null,
      error: { message: 'network down' },
    });

    const service = TestBed.inject(SpeedrunLeaderboardService);
    await service.refresh();

    expect(service.entries()).toEqual([]);
    expect(service.error()).toBe('network down');
  });
});
