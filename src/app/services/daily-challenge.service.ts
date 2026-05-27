import { Injectable, computed, inject, signal } from '@angular/core';
import { CountryShape } from '../models/country-shape';
import { CountrySummary } from '../models/country-summary';
import { shuffleItems } from '../utils/array-utils';
import { BrowserStorageService } from './browser-storage.service';
import { DAILY_CHALLENGE_XP } from './xp-progression';

export type DailyChallengeMode =
  | 'country-to-flag'
  | 'flag-to-country'
  | 'shape-to-country'
  | 'capital-to-country';

export type DailyChallengeState = {
  dateKey: string;
  xp: number;
  questionCount: number;
  completed: boolean;
  completedAt: string | null;
};

export type DailyChallengeQuestion = {
  id: string;
  mode: DailyChallengeMode;
  promptCountry: CountrySummary;
  options: CountrySummary[];
  correctCode: string;
  shapePath?: string;
};

type DailyChallengeStore = Record<string, string>;

const STORAGE_KEY = 'vexiio.daily-challenges.v1';
export const DAILY_CHALLENGE_QUESTION_COUNT = 15;
export const DAILY_CHALLENGE_MAX_ERRORS = 1;
const OPTION_COUNT = 4;
const MODE_SEQUENCE: DailyChallengeMode[] = [
  'country-to-flag',
  'flag-to-country',
  'shape-to-country',
  'capital-to-country',
];

@Injectable({ providedIn: 'root' })
export class DailyChallengeService {
  private readonly storage = inject(BrowserStorageService);
  private readonly completions = signal<DailyChallengeStore>(this.loadCompletions());

  readonly today = computed<DailyChallengeState>(() => {
    const dateKey = this.todayDateKey();
    const completedAt = this.completions()[dateKey] ?? null;

    return {
      dateKey,
      xp: DAILY_CHALLENGE_XP,
      questionCount: DAILY_CHALLENGE_QUESTION_COUNT,
      completed: completedAt !== null,
      completedAt,
    };
  });

  readonly bonusXp = computed(() => Object.keys(this.completions()).length * DAILY_CHALLENGE_XP);

  buildQuestionPlan(
    countries: CountrySummary[],
    shapes: CountryShape[],
    dateKey = this.todayDateKey(),
  ): DailyChallengeQuestion[] {
    const cleanCountries = countries.filter((country) => country.code && country.flagUrl);
    const shapeByCode = new Map(shapes.map((shape) => [shape.code, shape.path]));
    const shapeCountries = cleanCountries.filter((country) => shapeByCode.has(country.code));
    const capitalCountries = cleanCountries.filter(
      (country) =>
        this.hasVisibleText(country.capitalFrench) || this.hasVisibleText(country.capitalEnglish),
    );
    const pools: Record<DailyChallengeMode, CountrySummary[]> = {
      'country-to-flag': cleanCountries,
      'flag-to-country': cleanCountries,
      'shape-to-country': shapeCountries,
      'capital-to-country': capitalCountries,
    };

    if (Object.values(pools).some((pool) => pool.length < OPTION_COUNT)) {
      return [];
    }

    const rng = this.createRng(`daily-challenge:${dateKey}`);
    const modes = this.buildDailyModes(dateKey);
    const usedByMode = new Map<DailyChallengeMode, Set<string>>();

    return modes.map((mode, index) => {
      const pool = pools[mode];
      const usedCodes = usedByMode.get(mode) ?? new Set<string>();
      if (pool.length - usedCodes.size < OPTION_COUNT) {
        usedCodes.clear();
      }

      const availablePrompts = pool.filter((country) => !usedCodes.has(country.code));
      const promptCountry = this.pickOne(availablePrompts.length ? availablePrompts : pool, rng);
      usedCodes.add(promptCountry.code);
      usedByMode.set(mode, usedCodes);

      const distractors = this.pickMany(
        pool.filter((country) => country.code !== promptCountry.code),
        OPTION_COUNT - 1,
        rng,
      );
      const options = shuffleItems([promptCountry, ...distractors], rng);

      return {
        id: `${dateKey}-${index + 1}`,
        mode,
        promptCountry,
        options,
        correctCode: promptCountry.code,
        shapePath: mode === 'shape-to-country' ? shapeByCode.get(promptCountry.code) : undefined,
      };
    });
  }

  completeToday(answeredCount: number, mistakeCount: number): boolean {
    const today = this.today();
    if (
      today.completed ||
      answeredCount < today.questionCount ||
      mistakeCount > DAILY_CHALLENGE_MAX_ERRORS
    ) {
      return false;
    }

    const completedAt = new Date().toISOString();
    this.completions.update((current) => ({
      ...current,
      [today.dateKey]: completedAt,
    }));
    this.storage.setJson(STORAGE_KEY, this.completions());
    return true;
  }

  private buildDailyModes(dateKey: string): DailyChallengeMode[] {
    const dayIndex = Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000);
    const offset = dayIndex % MODE_SEQUENCE.length;
    return Array.from({ length: DAILY_CHALLENGE_QUESTION_COUNT }, (_, index) => {
      const modeIndex = (index + offset) % MODE_SEQUENCE.length;
      return MODE_SEQUENCE[modeIndex];
    });
  }

  private todayDateKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private hasVisibleText(value: string): boolean {
    return value.trim().length > 0 && value.trim() !== '-';
  }

  private createRng(seedText: string): () => number {
    let hash = 2166136261;
    for (let index = 0; index < seedText.length; index += 1) {
      hash ^= seedText.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return () => {
      hash += 0x6d2b79f5;
      let value = hash;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  private pickOne<T>(items: T[], rng: () => number): T {
    return items[Math.floor(rng() * items.length)];
  }

  private pickMany<T>(items: T[], count: number, rng: () => number): T[] {
    return shuffleItems(items, rng).slice(0, count);
  }

  private loadCompletions(): DailyChallengeStore {
    const parsed = this.storage.getJson<DailyChallengeStore>(STORAGE_KEY, {});
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([dateKey, completedAt]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof completedAt === 'string',
      ),
    );
  }
}
