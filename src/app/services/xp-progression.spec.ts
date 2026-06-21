import {
  DAILY_CHALLENGE_XP,
  DAILY_STREAK_BONUS_MAX,
  calculateDailyStreakBonus,
  computeDailyChallengeStreak,
  computeDailyChallengeStreakAfterCompletion,
  isDailyChallengeStreakBroken,
  shiftUtcDateKey,
  SPEEDRUN_CLEAN_RUN_XP,
  SPEEDRUN_COMPLETION_XP,
  SPEEDRUN_SPLIT_BEST_XP,
  MAX_LEVEL,
  buildLevelProgress,
  calculateRecordXp,
  calculateSpeedrunPerformanceXp,
  calculateSpeedrunXp,
  getLevelThreshold,
  getLevelTier,
  getXpRequiredForNextLevel,
  resolveLevelFromXp,
  sumXpEventAmounts,
} from './xp-progression';
import { SPEEDRUN_SPLITS, buildSpeedrunResult, buildSpeedrunSplitResult } from '../models/speedrun';

describe('xp progression', () => {
  it('uses a growing XP curve until level 50', () => {
    expect(getXpRequiredForNextLevel(2)).toBeGreaterThan(getXpRequiredForNextLevel(1));
    expect(getXpRequiredForNextLevel(20)).toBeGreaterThan(getXpRequiredForNextLevel(10));
    expect(getXpRequiredForNextLevel(MAX_LEVEL)).toBe(0);
  });

  it('caps the resolved level at 50', () => {
    const level50Threshold = getLevelThreshold(MAX_LEVEL);

    expect(resolveLevelFromXp(level50Threshold + 1_000_000)).toBe(MAX_LEVEL);
    expect(buildLevelProgress(level50Threshold + 1_000_000).progressPercent).toBe(100);
  });

  it('resolves the requested visual level tiers', () => {
    expect(getLevelTier(1).id).toBe('gray');
    expect(getLevelTier(5).id).toBe('green');
    expect(getLevelTier(10).id).toBe('blue');
    expect(getLevelTier(20).id).toBe('violet');
    expect(getLevelTier(40).id).toBe('red');
    expect(getLevelTier(50).id).toBe('gold');
  });

  it('limits repeat run XP while keeping performance valuable', () => {
    const weakRepeatXp = calculateRecordXp({
      bestScore: 1,
      bestMaxScore: 10,
      bestPercent: 10,
      bestStreak: 0,
      gamesPlayed: 40,
      lastPlayedAt: '2026-05-24T00:00:00.000Z',
    });
    const strongFirstRunXp = calculateRecordXp({
      bestScore: 10,
      bestMaxScore: 10,
      bestPercent: 100,
      bestStreak: 10,
      gamesPlayed: 1,
      lastPlayedAt: '2026-05-24T00:00:00.000Z',
    });

    expect(strongFirstRunXp).toBeGreaterThan(weakRepeatXp);
  });

  it('awards speedrun XP from best performance instead of farmable run count', () => {
    const bestRun = {
      ...buildSpeedrunResult(9 * 60_000, 0, '2026-05-24T00:00:00.000Z'),
      userId: 'user-1',
    };
    const splitBest = buildSpeedrunSplitResult(
      SPEEDRUN_SPLITS[0],
      90_000,
      0,
      null,
      '2026-05-24T00:00:00.000Z',
    );

    expect(calculateSpeedrunXp(bestRun, [splitBest, null, null, null])).toBe(
      SPEEDRUN_COMPLETION_XP +
        calculateSpeedrunPerformanceXp(bestRun.totalTimeMs) +
        SPEEDRUN_CLEAN_RUN_XP +
        SPEEDRUN_SPLIT_BEST_XP,
    );
  });

  it('sums xp event amounts while ignoring null values', () => {
    expect(sumXpEventAmounts([{ amount: 120 }, { amount: 80 }, { amount: null }])).toBe(200);
    expect(sumXpEventAmounts([])).toBe(0);
  });

  it('scales daily streak bonus up to the configured cap', () => {
    expect(calculateDailyStreakBonus(1)).toBe(0);
    expect(calculateDailyStreakBonus(2)).toBeGreaterThan(0);
    expect(calculateDailyStreakBonus(30)).toBe(DAILY_STREAK_BONUS_MAX);
    expect(calculateDailyStreakBonus(60)).toBe(DAILY_STREAK_BONUS_MAX);
  });

  it('counts consecutive UTC daily challenge streaks and detects breaks', () => {
    const completions = ['2026-05-20', '2026-05-21', '2026-05-22'];

    expect(computeDailyChallengeStreak(completions, '2026-05-22')).toBe(3);
    expect(computeDailyChallengeStreak(completions, '2026-05-23')).toBe(3);
    expect(computeDailyChallengeStreakAfterCompletion(['2026-05-21'], '2026-05-22')).toBe(2);
    expect(computeDailyChallengeStreak(['2026-05-20', '2026-05-22'], '2026-05-22')).toBe(1);
    expect(isDailyChallengeStreakBroken(completions, '2026-05-23')).toBe(false);
    expect(isDailyChallengeStreakBroken(['2026-05-20'], '2026-05-22')).toBe(true);
    expect(shiftUtcDateKey('2026-05-22', -1)).toBe('2026-05-21');
  });
});
