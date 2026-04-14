import { CountrySummary } from './country-summary';

export type CountryNameQuizQuestion = {
  difficulty: 'easy' | 'hard';
  promptCountry: CountrySummary;
  options: CountrySummary[];
  correctCode: string;
};
