import { PersonalRecord } from '../models/personal-record';
import { SpeedrunSplitBest, SpeedrunUserRecord } from '../models/speedrun';

export const MAX_LEVEL = 50;
export const DAILY_CHALLENGE_XP = 250;
export const FIRST_MODE_COMPLETION_XP = 150;
export const REPEAT_MODE_COMPLETION_XP = 12;
export const LOW_VALUE_REPEAT_XP = 2;
export const REPEAT_COMPLETION_XP_CAP = 20;
export const SPEEDRUN_COMPLETION_XP = 350;
export const SPEEDRUN_CLEAN_RUN_XP = 250;
export const SPEEDRUN_SPLIT_BEST_XP = 90;

export type AchievementDifficulty = 'easy' | 'medium' | 'hard' | 'rare';
export type LevelTierId = 'gray' | 'green' | 'blue' | 'violet' | 'red' | 'gold';

export type LevelTierDefinition = {
  id: LevelTierId;
  minLevel: number;
  maxLevel: number;
  labelKey: string;
  nextLevel: number | null;
};

export type LevelProgress = {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  tier: LevelTierDefinition;
};

export const ACHIEVEMENT_XP_BY_DIFFICULTY: Record<AchievementDifficulty, number> = {
  easy: 50,
  medium: 125,
  hard: 250,
  rare: 400,
};

export const LEVEL_TIERS: LevelTierDefinition[] = [
  {
    id: 'gray',
    minLevel: 1,
    maxLevel: 4,
    labelKey: 'gamification.tier.gray',
    nextLevel: 5,
  },
  {
    id: 'green',
    minLevel: 5,
    maxLevel: 9,
    labelKey: 'gamification.tier.green',
    nextLevel: 10,
  },
  {
    id: 'blue',
    minLevel: 10,
    maxLevel: 19,
    labelKey: 'gamification.tier.blue',
    nextLevel: 20,
  },
  {
    id: 'violet',
    minLevel: 20,
    maxLevel: 39,
    labelKey: 'gamification.tier.violet',
    nextLevel: 40,
  },
  {
    id: 'red',
    minLevel: 40,
    maxLevel: 49,
    labelKey: 'gamification.tier.red',
    nextLevel: 50,
  },
  {
    id: 'gold',
    minLevel: 50,
    maxLevel: 50,
    labelKey: 'gamification.tier.gold',
    nextLevel: null,
  },
];

export function getLevelTier(level: number): LevelTierDefinition {
  const safeLevel = clamp(Math.floor(level), 1, MAX_LEVEL);
  return (
    LEVEL_TIERS.find((tier) => safeLevel >= tier.minLevel && safeLevel <= tier.maxLevel) ??
    LEVEL_TIERS[0]
  );
}

export function getXpRequiredForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) {
    return 0;
  }

  const safeLevel = clamp(Math.floor(level), 1, MAX_LEVEL - 1);
  if (safeLevel < 5) {
    return 600 + safeLevel * 40;
  }

  if (safeLevel < 10) {
    return 1200 + safeLevel * 85;
  }

  if (safeLevel < 20) {
    return 1850 + safeLevel * 95;
  }

  if (safeLevel < 40) {
    return 1900 + safeLevel * 75;
  }

  return 3600 + safeLevel * 100;
}

export function getLevelThreshold(level: number): number {
  const safeLevel = clamp(Math.floor(level), 1, MAX_LEVEL);
  let threshold = 0;

  for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
    threshold += getXpRequiredForNextLevel(currentLevel);
  }

  return threshold;
}

export function resolveLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;

  while (level < MAX_LEVEL && safeXp >= getLevelThreshold(level + 1)) {
    level += 1;
  }

  return level;
}

export function buildLevelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = resolveLevelFromXp(safeXp);
  const currentLevelXp = getLevelThreshold(level);
  const nextLevelXp = level >= MAX_LEVEL ? currentLevelXp : getLevelThreshold(level + 1);
  const progressPercent =
    nextLevelXp > currentLevelXp
      ? clamp(
          Math.round(((safeXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100),
          0,
          100,
        )
      : 100;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    tier: getLevelTier(level),
  };
}

export function calculateRecordXp(record: PersonalRecord): number {
  const gamesPlayed = Math.max(0, record.gamesPlayed);
  if (gamesPlayed === 0) {
    return 0;
  }

  const countedRepeatRuns = Math.min(Math.max(gamesPlayed - 1, 0), REPEAT_COMPLETION_XP_CAP);
  const lowValueRepeatRuns = Math.max(gamesPlayed - 1 - REPEAT_COMPLETION_XP_CAP, 0);
  const completionXp =
    FIRST_MODE_COMPLETION_XP +
    countedRepeatRuns * REPEAT_MODE_COMPLETION_XP +
    lowValueRepeatRuns * LOW_VALUE_REPEAT_XP;
  const antiFarmMultiplier = getCompletionXpMultiplier(record.bestPercent);
  const performanceXp =
    record.bestPercent * 2 +
    (record.bestStreak ?? 0) * 15 +
    Math.min(Math.max(record.bestScore, 0), 500);

  return Math.round(completionXp * antiFarmMultiplier + performanceXp);
}

export function calculateSpeedrunXp(
  bestRun: SpeedrunUserRecord | null,
  splitBests: Array<SpeedrunSplitBest | null>,
): number {
  if (!bestRun) {
    return 0;
  }

  const splitBestCount = splitBests.filter(Boolean).length;
  const cleanRunXp = bestRun.mistakeCount === 0 ? SPEEDRUN_CLEAN_RUN_XP : 0;

  return (
    SPEEDRUN_COMPLETION_XP +
    calculateSpeedrunPerformanceXp(bestRun.totalTimeMs) +
    cleanRunXp +
    splitBestCount * SPEEDRUN_SPLIT_BEST_XP
  );
}

export function calculateSpeedrunPerformanceXp(totalTimeMs: number): number {
  const safeTimeMs = Math.max(0, Math.round(totalTimeMs));

  if (safeTimeMs <= 8 * 60_000) {
    return 600;
  }

  if (safeTimeMs <= 10 * 60_000) {
    return 450;
  }

  if (safeTimeMs <= 12 * 60_000) {
    return 300;
  }

  if (safeTimeMs <= 15 * 60_000) {
    return 180;
  }

  return 100;
}

function getCompletionXpMultiplier(bestPercent: number): number {
  if (bestPercent < 30) {
    return 0.25;
  }

  if (bestPercent < 50) {
    return 0.6;
  }

  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
