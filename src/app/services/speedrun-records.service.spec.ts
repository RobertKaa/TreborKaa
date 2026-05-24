import { TestBed } from '@angular/core/testing';
import {
  SPEEDRUN_SPLITS,
  buildSpeedrunResult,
  buildSpeedrunSplitResult,
  formatSpeedrunTime,
} from '../models/speedrun';
import { SpeedrunRecordsService } from './speedrun-records.service';

describe('SpeedrunRecordsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('keeps only the best speedrun time per user', () => {
    const service = TestBed.inject(SpeedrunRecordsService);
    const first = buildSpeedrunResult(42_000, 1, '2026-05-19T18:00:00.000Z');
    const slower = buildSpeedrunResult(48_000, 1, '2026-05-19T18:01:00.000Z');
    const faster = buildSpeedrunResult(38_000, 0, '2026-05-19T18:02:00.000Z');

    service.saveBestForUser('user-1', first);
    service.saveBestForUser('user-1', slower);
    expect(service.getBestForUser('user-1')?.totalTimeMs).toBe(first.totalTimeMs);

    service.saveBestForUser('user-1', faster);
    expect(service.getBestForUser('user-1')?.totalTimeMs).toBe(faster.totalTimeMs);
  });

  it('formats speedrun time with centiseconds', () => {
    expect(formatSpeedrunTime(72_345)).toBe('1:12.34');
  });

  it('keeps only improved split bests per user', () => {
    const service = TestBed.inject(SpeedrunRecordsService);
    const split = SPEEDRUN_SPLITS[0];
    const first = buildSpeedrunSplitResult(split, 20_000, 0, null, '2026-05-19T18:00:00.000Z');
    const slower = buildSpeedrunSplitResult(split, 22_000, 0, 20_000, '2026-05-19T18:01:00.000Z');
    const faster = buildSpeedrunSplitResult(split, 18_000, 0, 20_000, '2026-05-19T18:02:00.000Z');

    service.saveSplitBestsForUser('user-1', [first]);
    service.saveSplitBestsForUser('user-1', [slower]);
    expect(service.getBestSplitForUser('user-1', split.id)?.totalTimeMs).toBe(first.totalTimeMs);

    service.saveSplitBestsForUser('user-1', [faster]);
    expect(service.getBestSplitForUser('user-1', split.id)?.totalTimeMs).toBe(faster.totalTimeMs);
  });

  it('merges remote speedrun bests without replacing better local values', () => {
    const service = TestBed.inject(SpeedrunRecordsService);
    const localBest = {
      ...buildSpeedrunResult(38_000, 0, '2026-05-19T18:00:00.000Z'),
      userId: 'user-1',
    };
    const remoteSlower = {
      ...buildSpeedrunResult(42_000, 0, '2026-05-19T18:01:00.000Z'),
      userId: 'user-1',
    };
    const remoteFaster = {
      ...buildSpeedrunResult(34_000, 0, '2026-05-19T18:02:00.000Z'),
      userId: 'user-1',
    };

    service.mergeBestForUser('user-1', localBest);
    service.mergeBestForUser('user-1', remoteSlower);
    expect(service.getBestForUser('user-1')?.totalTimeMs).toBe(localBest.totalTimeMs);

    service.mergeBestForUser('user-1', remoteFaster);
    expect(service.getBestForUser('user-1')?.totalTimeMs).toBe(remoteFaster.totalTimeMs);
  });
});
