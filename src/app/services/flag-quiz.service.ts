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
  private readonly recentDistractorCodes: string[] = [];
  private readonly recentPromptCodes: string[] = [];
  private readonly recentOptionSignatures: string[] = [];
  private readonly recentDistractorLimit = 30;
  private readonly recentPromptLimit = 12;
  private readonly recentSignatureLimit = 18;

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
    const promptCountry = this.pickPromptCountry(pool);
    const rankedDistractors = this.rankDistractors(countries, promptCountry);
    const distractors =
      difficulty === 'hard'
        ? this.selectHardDistractors(rankedDistractors)
        : this.selectEasyDistractors(rankedDistractors);
    const options = this.shuffle([promptCountry, ...distractors]);
    this.rememberQuestion(promptCountry.code, distractors.map((country) => country.code), options);

    return { promptCountry, options, correctCode: promptCountry.code };
  }

  private selectHardDistractors(rankedDistractors: ScoredCountry[]): CountrySummary[] {
    if (rankedDistractors.length <= 3) {
      return rankedDistractors.map((item) => item.country);
    }

    const topScore = rankedDistractors[0]?.score ?? 0;
    const elitePool = rankedDistractors.filter((item, index) => {
      if (index >= 18) {
        return false;
      }

      return item.score >= Math.max(8, topScore - 8);
    });
    const fallbackPool = rankedDistractors.slice(0, Math.min(28, rankedDistractors.length));
    const candidatePool = elitePool.length >= 6 ? elitePool : fallbackPool;

    return this.pickWeightedCountries(candidatePool, 3, 'hard');
  }

  private selectEasyDistractors(rankedDistractors: ScoredCountry[]): CountrySummary[] {
    if (rankedDistractors.length <= 3) {
      return rankedDistractors.map((item) => item.country);
    }

    const topScore = rankedDistractors[0]?.score ?? 0;
    const broadPool = rankedDistractors.filter((item, index) => {
      if (index < 4 && item.score >= Math.max(10, topScore - 5)) {
        return false;
      }

      return index < 40;
    });
    const candidatePool = broadPool.length >= 6 ? broadPool : rankedDistractors.slice(6, 36);

    return this.pickWeightedCountries(candidatePool, 3, 'easy');
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

  private pickPromptCountry(countries: CountrySummary[]): CountrySummary {
    if (countries.length <= 1) {
      return countries[0];
    }

    const freshPool = countries.filter((country) => !this.recentPromptCodes.includes(country.code));
    return this.pickRandom(freshPool.length > 0 ? freshPool : countries);
  }

  private pickRandom(countries: CountrySummary[]): CountrySummary {
    return countries[Math.floor(Math.random() * countries.length)];
  }

  private pickWeightedCountries(
    candidates: ScoredCountry[],
    count: number,
    difficulty: 'easy' | 'hard'
  ): CountrySummary[] {
    const selected: CountrySummary[] = [];
    const pool = [...candidates];

    while (selected.length < count && pool.length > 0) {
      const weightedPool = pool.map((item) => ({
        item,
        weight: this.computeDistractorWeight(item, difficulty)
      }));
      const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);

      if (totalWeight <= 0) {
        selected.push(...this.shuffle(pool).slice(0, count - selected.length).map((item) => item.country));
        break;
      }

      let cursor = Math.random() * totalWeight;
      let pickedIndex = 0;

      for (let index = 0; index < weightedPool.length; index += 1) {
        cursor -= weightedPool[index].weight;
        if (cursor <= 0) {
          pickedIndex = index;
          break;
        }
      }

      const [picked] = pool.splice(pickedIndex, 1);
      selected.push(picked.country);
    }

    return selected;
  }

  private computeDistractorWeight(
    candidate: ScoredCountry,
    difficulty: 'easy' | 'hard'
  ): number {
    const repetitionPenalty = this.recentDistractorCodes.includes(candidate.country.code) ? 0.34 : 1;
    const baseWeight =
      difficulty === 'hard'
        ? Math.max(1, candidate.score + 2)
        : Math.max(1, 22 - Math.min(candidate.score, 18));
    const noise = 0.75 + Math.random() * 0.7;

    return baseWeight * repetitionPenalty * noise;
  }

  private rememberQuestion(promptCode: string, distractorCodes: string[], options: CountrySummary[]): void {
    this.pushRecent(this.recentPromptCodes, promptCode, this.recentPromptLimit);

    for (const code of distractorCodes) {
      this.pushRecent(this.recentDistractorCodes, code, this.recentDistractorLimit);
    }

    const signature = options
      .map((option) => option.code)
      .sort()
      .join('|');
    this.pushRecent(this.recentOptionSignatures, signature, this.recentSignatureLimit);
  }

  private pushRecent(target: string[], value: string, limit: number): void {
    target.push(value);

    while (target.length > limit) {
      target.shift();
    }
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
