export type FlagCultureDifficulty = 'easy' | 'medium' | 'hard';
export type FlagCultureDifficultyMode = FlagCultureDifficulty | 'mixed';

export type FlagCultureTopic =
  | 'history'
  | 'symbol'
  | 'design'
  | 'record'
  | 'comparison';

export type FlagCultureQuestion = {
  id: string;
  difficulty: FlagCultureDifficulty;
  topic: FlagCultureTopic;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  countryCode?: string;
  sourceUrl?: string;
};

export type FlagCultureRoundQuestion = FlagCultureQuestion & {
  shuffledOptions: string[];
};
