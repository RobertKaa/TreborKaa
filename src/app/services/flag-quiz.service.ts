import { Injectable } from '@angular/core';
import { FLAG_FAMILY_GROUPS } from '../data/flag-families';
import { FLAG_PROFILES, FlagProfile } from '../data/flag-profiles';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { CountrySummary } from '../models/country-summary';
import { FlagQuizQuestion } from '../models/flag-quiz-question';

type ScoredCountry = {
  country: CountrySummary;
  score: number;
};

@Injectable({ providedIn: 'root' })
export class FlagQuizService {
  private readonly familyIndex = new Map<string, Set<string>>();

  constructor() {
    for (const group of FLAG_FAMILY_GROUPS) {
      const members = new Set(group);
      for (const code of group) {
        this.familyIndex.set(code, members);
      }
    }
  }

  buildQuestion(
    countries: CountrySummary[],
    difficulty: 'easy' | 'hard',
    excludeCodes: string[] = []
  ): FlagQuizQuestion {
    const baseQuestion = this.buildBaseQuestion(countries, difficulty, excludeCodes);

    return {
      difficulty,
      promptCountry: baseQuestion.promptCountry,
      options: baseQuestion.options,
      correctCode: baseQuestion.correctCode
    };
  }

  buildCountryNameQuestion(
    countries: CountrySummary[],
    difficulty: 'easy' | 'hard',
    excludeCodes: string[] = []
  ): CountryNameQuizQuestion {
    const baseQuestion = this.buildBaseQuestion(countries, difficulty, excludeCodes);

    return {
      difficulty,
      promptCountry: baseQuestion.promptCountry,
      options: baseQuestion.options,
      correctCode: baseQuestion.correctCode
    };
  }

  private buildBaseQuestion(
    countries: CountrySummary[],
    difficulty: 'easy' | 'hard',
    excludeCodes: string[] = []
  ) {
    const pool = countries.filter((country) => !excludeCodes.includes(country.code));
    const promptCountry = this.pickRandom(pool);
    const rankedDistractors = this.rankDistractors(countries, promptCountry);
    const distractorPool =
      difficulty === 'hard'
        ? rankedDistractors
        : [...rankedDistractors].reverse();
    const distractors = distractorPool.slice(0, 3).map((item) => item.country);
    const options = this.shuffle([promptCountry, ...distractors]);

    return { promptCountry, options, correctCode: promptCountry.code };
  }

  private rankDistractors(
    countries: CountrySummary[],
    promptCountry: CountrySummary
  ): ScoredCountry[] {
    return countries
      .filter((country) => country.code !== promptCountry.code)
      .map((country) => ({
        country,
        score: this.computeSimilarity(promptCountry.code, country.code)
      }))
      .sort((left, right) => right.score - left.score);
  }

  private computeSimilarity(leftCode: string, rightCode: string): number {
    const leftProfile = FLAG_PROFILES[leftCode];
    const rightProfile = FLAG_PROFILES[rightCode];
    const leftFamily = this.familyIndex.get(leftCode) ?? new Set<string>();
    let score = leftFamily.has(rightCode) ? 18 : 0;

    if (!leftProfile || !rightProfile) {
      return score;
    }

    score += this.countOverlap(leftProfile.colors, rightProfile.colors) * 4;
    score += leftProfile.layout === rightProfile.layout ? 8 : 0;
    score += this.countOverlap(leftProfile.symbols ?? [], rightProfile.symbols ?? []) * 6;
    score += this.countOverlap(leftProfile.traits ?? [], rightProfile.traits ?? []) * 5;
    score += this.sharePrimaryColor(leftProfile, rightProfile) ? 2 : 0;
    score += this.haveSameColorCount(leftProfile, rightProfile) ? 1 : 0;

    return score;
  }

  private countOverlap(left: string[], right: string[]): number {
    const rightSet = new Set(right);
    return left.filter((value) => rightSet.has(value)).length;
  }

  private sharePrimaryColor(left: FlagProfile, right: FlagProfile): boolean {
    return left.colors[0] !== undefined && left.colors[0] === right.colors[0];
  }

  private haveSameColorCount(left: FlagProfile, right: FlagProfile): boolean {
    return left.colors.length === right.colors.length;
  }

  private pickRandom(countries: CountrySummary[]): CountrySummary {
    return countries[Math.floor(Math.random() * countries.length)];
  }

  private shuffle<T>(values: T[]): T[] {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }
}
