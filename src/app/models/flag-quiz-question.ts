import { CountrySummary } from './country-summary';

export type FlagQuizQuestion = {
  difficulty: 'easy' | 'hard';
  promptCountry: CountrySummary;
  options: CountrySummary[];
  correctCode: string;
};
