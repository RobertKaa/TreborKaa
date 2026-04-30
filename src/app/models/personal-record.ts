export type GameRecordKey =
  | 'country-to-flag-easy'
  | 'country-to-flag-hard'
  | 'flag-to-country-easy'
  | 'flag-to-country-hard'
  | 'shape-to-country-easy'
  | 'shape-to-country-hard'
  | 'flag-rebuild'
  | 'flag-rebuild-beta'
  | 'find-the-error'
  | 'pixel-flag'
  | 'chrono-flags'
  | 'flag-culture-easy'
  | 'flag-culture-medium'
  | 'flag-culture-hard'
  | 'flag-culture-mixed';

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
