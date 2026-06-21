export type GameRecordKey =
  | 'country-to-flag-easy'
  | 'flag-to-country-easy'
  | 'shape-to-country-easy'
  | 'capital-to-country-easy'
  | 'flag-rebuild'
  | 'find-the-error'
  | 'pixel-flag'
  | 'chrono-flags';

export type PersonalRecord = {
  bestScore: number;
  bestMaxScore: number;
  bestPercent: number;
  gamesPlayed: number;
  lastPlayedAt: string;
  bestStreak?: number;
};

export type GameResultPayload = {
  score: number;
  maxScore: number;
  percentOverride?: number;
  streak?: number;
};
