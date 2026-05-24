import { CountrySummary } from './country-summary';

export type SpeedrunQuestionMode =
  | 'country-to-flag'
  | 'flag-to-country'
  | 'capital-to-country'
  | 'shape-to-country';
type SpeedrunDifficulty = 'easy' | 'hard';
export type SpeedrunSplitId =
  | 'country-to-flag-hard'
  | 'flag-to-country-hard'
  | 'capital-to-country'
  | 'shape-to-country';

export type SpeedrunSplit = {
  id: SpeedrunSplitId;
  order: number;
  mode: SpeedrunQuestionMode;
  difficulty: SpeedrunDifficulty;
  labelKey: string;
  questionCount: number;
};

export type SpeedrunQuestion = {
  split: SpeedrunSplit;
  questionNumber: number;
  promptCountry: CountrySummary;
  options: CountrySummary[];
  correctCode: string;
  shapePath?: string;
  shapeViewBox?: string;
};

export type SpeedrunMistake = {
  split: SpeedrunSplit;
  questionNumber: number;
  promptCountryName: string;
  selectedCountryName: string | null;
  correctCountryName: string;
};

export type SpeedrunSplitResult = {
  splitId: SpeedrunSplitId;
  labelKey: string;
  rawTimeMs: number;
  penaltyMs: number;
  totalTimeMs: number;
  correctCount: number;
  mistakeCount: number;
  completedAt: string;
  bestBeforeMs: number | null;
  deltaMs: number | null;
  isImprovement: boolean;
};

export type SpeedrunRunResult = {
  rawTimeMs: number;
  penaltyMs: number;
  totalTimeMs: number;
  correctCount: number;
  mistakeCount: number;
  completedAt: string;
  splitResults?: SpeedrunSplitResult[];
};

export type SpeedrunUserRecord = SpeedrunRunResult & {
  userId: string;
};

export type SpeedrunSplitBest = {
  splitId: SpeedrunSplitId;
  totalTimeMs: number;
  rawTimeMs: number;
  penaltyMs: number;
  mistakeCount: number;
  completedAt: string;
};

const SPEEDRUN_SPLIT_QUESTION_COUNT = 15;

export const SPEEDRUN_SPLITS: SpeedrunSplit[] = [
  {
    id: 'country-to-flag-hard',
    order: 1,
    mode: 'country-to-flag',
    difficulty: 'hard',
    labelKey: 'speedrun.split.countryToFlagHard',
    questionCount: SPEEDRUN_SPLIT_QUESTION_COUNT,
  },
  {
    id: 'flag-to-country-hard',
    order: 2,
    mode: 'flag-to-country',
    difficulty: 'hard',
    labelKey: 'speedrun.split.flagToCountryHard',
    questionCount: SPEEDRUN_SPLIT_QUESTION_COUNT,
  },
  {
    id: 'capital-to-country',
    order: 3,
    mode: 'capital-to-country',
    difficulty: 'hard',
    labelKey: 'speedrun.split.capitalToCountry',
    questionCount: SPEEDRUN_SPLIT_QUESTION_COUNT,
  },
  {
    id: 'shape-to-country',
    order: 4,
    mode: 'shape-to-country',
    difficulty: 'hard',
    labelKey: 'speedrun.split.shapeToCountry',
    questionCount: SPEEDRUN_SPLIT_QUESTION_COUNT,
  },
];

export const SPEEDRUN_ERROR_PENALTY_MS = 30000;
export const SPEEDRUN_TOTAL_QUESTIONS = SPEEDRUN_SPLITS.reduce(
  (total, split) => total + split.questionCount,
  0,
);

export function formatSpeedrunTime(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, Math.round(milliseconds));
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((safeMilliseconds % 1000) / 10);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds
    .toString()
    .padStart(2, '0')}`;
}

export function buildSpeedrunResult(
  rawTimeMs: number,
  mistakeCount: number,
  completedAt = new Date().toISOString(),
  splitResults: SpeedrunSplitResult[] = [],
): SpeedrunRunResult {
  const safeMistakeCount = Math.max(0, Math.round(mistakeCount));
  const penaltyMs = safeMistakeCount * SPEEDRUN_ERROR_PENALTY_MS;
  const rawTime = Math.max(0, Math.round(rawTimeMs));

  return {
    rawTimeMs: rawTime,
    penaltyMs,
    totalTimeMs: rawTime + penaltyMs,
    correctCount: Math.max(0, SPEEDRUN_TOTAL_QUESTIONS - safeMistakeCount),
    mistakeCount: safeMistakeCount,
    completedAt,
    splitResults,
  };
}

export function buildSpeedrunSplitResult(
  split: SpeedrunSplit,
  rawTimeMs: number,
  mistakeCount: number,
  bestBeforeMs: number | null,
  completedAt = new Date().toISOString(),
): SpeedrunSplitResult {
  const safeMistakeCount = Math.max(0, Math.round(mistakeCount));
  const penaltyMs = safeMistakeCount * SPEEDRUN_ERROR_PENALTY_MS;
  const rawTime = Math.max(0, Math.round(rawTimeMs));
  const totalTimeMs = rawTime + penaltyMs;
  const deltaMs = bestBeforeMs === null ? null : totalTimeMs - bestBeforeMs;

  return {
    splitId: split.id,
    labelKey: split.labelKey,
    rawTimeMs: rawTime,
    penaltyMs,
    totalTimeMs,
    correctCount: Math.max(0, split.questionCount - safeMistakeCount),
    mistakeCount: safeMistakeCount,
    completedAt,
    bestBeforeMs,
    deltaMs,
    isImprovement: bestBeforeMs === null || totalTimeMs < bestBeforeMs,
  };
}
