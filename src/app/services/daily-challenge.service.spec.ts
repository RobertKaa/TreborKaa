import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CountryShape } from '../models/country-shape';
import { CountrySummary } from '../models/country-summary';
import {
  DAILY_CHALLENGE_MAX_ERRORS,
  DAILY_CHALLENGE_QUESTION_COUNT,
  DailyChallengeService,
} from './daily-challenge.service';

const countries: CountrySummary[] = Array.from({ length: 20 }, (_, index) => {
  const code =
    String.fromCharCode(97 + Math.floor(index / 26)) + String.fromCharCode(97 + (index % 26));

  return {
    code,
    nameEnglish: `Country ${index}`,
    nameFrench: `Pays ${index}`,
    capitalEnglish: `Capital ${index}`,
    capitalFrench: `Capitale ${index}`,
    flagUrl: `flags/${code}.svg`,
  };
});
const shapes: CountryShape[] = countries.map((country) => ({
  code: country.code,
  path: 'M0 0h10v10H0z',
}));

describe('DailyChallengeService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the daily challenge state for the current date', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);

    expect(dailyChallenge.today()).toEqual({
      dateKey: '2026-05-22',
      xp: 250,
      streakBonus: 0,
      totalXp: 250,
      streak: 1,
      streakBroken: false,
      questionCount: DAILY_CHALLENGE_QUESTION_COUNT,
      completed: false,
      completedAt: null,
    });
  });

  it('builds the same mixed 15-question plan for a given date', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);
    const firstPlan = dailyChallenge.buildQuestionPlan(countries, shapes, '2026-05-22');
    const secondPlan = dailyChallenge.buildQuestionPlan(countries, shapes, '2026-05-22');

    expect(firstPlan.map((question) => question.mode)).toEqual([
      'capital-to-country',
      'country-to-flag',
      'flag-to-country',
      'shape-to-country',
      'capital-to-country',
      'country-to-flag',
      'flag-to-country',
      'shape-to-country',
      'capital-to-country',
      'country-to-flag',
      'flag-to-country',
      'shape-to-country',
      'capital-to-country',
      'country-to-flag',
      'flag-to-country',
    ]);
    expect(firstPlan).toEqual(secondPlan);
    expect(firstPlan).toHaveLength(DAILY_CHALLENGE_QUESTION_COUNT);
    expect(firstPlan.every((question) => question.options.length === 4)).toBe(true);
  });

  it('adds the daily bonus once after a valid challenge', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);

    expect(dailyChallenge.completeToday(14, 0)).toBe(false);
    expect(dailyChallenge.today().completed).toBe(false);
    expect(dailyChallenge.completeToday(15, DAILY_CHALLENGE_MAX_ERRORS + 1)).toBe(false);
    expect(dailyChallenge.completeToday(15, 1)).toBe(true);
    expect(dailyChallenge.completeToday(15, 0)).toBe(false);
    expect(dailyChallenge.today().completed).toBe(true);
    expect(dailyChallenge.today().streak).toBe(1);
    expect(dailyChallenge.bonusXp()).toBe(250);
  });

  it('increases streak bonus after consecutive completions', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);

    dailyChallenge.mergeRemoteCompletions({
      '2026-05-21': '2026-05-21T12:00:00.000Z',
    });

    expect(dailyChallenge.today().streak).toBe(2);
    expect(dailyChallenge.today().streakBonus).toBeGreaterThan(0);
    expect(dailyChallenge.today().totalXp).toBeGreaterThan(250);
    expect(dailyChallenge.today().streakBroken).toBe(false);
  });

  it('flags a broken streak when the previous day was missed', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);

    dailyChallenge.mergeRemoteCompletions({
      '2026-05-20': '2026-05-20T12:00:00.000Z',
    });

    expect(dailyChallenge.today().streak).toBe(1);
    expect(dailyChallenge.today().streakBroken).toBe(true);
  });

  it('merges remote completions without replacing an earlier completion date', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);

    dailyChallenge.mergeRemoteCompletions({
      '2026-05-21': '2026-05-21T12:00:00.000Z',
      '2026-05-22': '2026-05-22T13:00:00.000Z',
    });
    dailyChallenge.mergeRemoteCompletions({
      '2026-05-22': '2026-05-22T11:00:00.000Z',
    });

    expect(dailyChallenge.snapshot()).toEqual({
      '2026-05-21': '2026-05-21T12:00:00.000Z',
      '2026-05-22': '2026-05-22T11:00:00.000Z',
    });
    expect(dailyChallenge.bonusXp()).toBe(500 + dailyChallenge.today().streakBonus);
  });

  it('keeps the same snapshot when remote completions are already present', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);
    dailyChallenge.mergeRemoteCompletions({
      '2026-05-22': '2026-05-22T11:00:00.000Z',
    });
    const snapshot = dailyChallenge.snapshot();

    dailyChallenge.mergeRemoteCompletions(snapshot);

    expect(dailyChallenge.snapshot()).toBe(snapshot);
  });
});
