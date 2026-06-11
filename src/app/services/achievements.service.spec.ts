import { TestBed } from '@angular/core/testing';
import { AchievementsService } from './achievements.service';
import { GameProgressService } from './game-progress.service';
import { PersonalRecordsService } from './personal-records.service';

describe('AchievementsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('unlocks first-game when at least one run is saved', () => {
    const records = TestBed.inject(PersonalRecordsService);
    const achievements = TestBed.inject(AchievementsService);

    records.saveResult('country-to-flag-easy', { score: 3, maxScore: 10 });
    TestBed.tick();

    const firstGame = achievements.achievements().find((item) => item.id === 'first-game');
    expect(firstGame?.unlocked).toBe(true);
  });

  it('unlocks resume-ready when a game is in progress', () => {
    const progress = TestBed.inject(GameProgressService);
    const achievements = TestBed.inject(AchievementsService);

    progress.saveProgress(
      'pixel-flag',
      { score: 5 },
      { percent: 55, labelKey: 'home.resume.pixel' },
    );
    TestBed.tick();

    const resumeReady = achievements.achievements().find((item) => item.id === 'resume-ready');

    expect(resumeReady?.unlocked).toBe(true);
  });

  it('unlocks global and mystery achievements from records', () => {
    const records = TestBed.inject(PersonalRecordsService);
    const achievements = TestBed.inject(AchievementsService);

    records.saveResult('country-to-flag-easy', { score: 10, maxScore: 10, streak: 10 });
    records.saveResult('flag-to-country-easy', { score: 10, maxScore: 10 });
    records.saveResult('shape-to-country-easy', { score: 10, maxScore: 10 });
    records.saveResult('chrono-flags', {
      score: 950,
      maxScore: 950,
      percentOverride: 95,
      streak: 8,
    });
    records.saveResult('find-the-error', { score: 8, maxScore: 10, percentOverride: 80 });
    records.saveResult('pixel-flag', { score: 8, maxScore: 10, percentOverride: 80 });
    records.saveResult('flag-rebuild', { score: 800, maxScore: 1000, percentOverride: 80 });
    TestBed.tick();

    const byId = new Map(achievements.achievements().map((item) => [item.id, item]));

    expect(byId.get('visual-trio')?.unlocked).toBe(true);
    expect(byId.get('chrono-sprinter')?.unlocked).toBe(true);
    expect(byId.get('rebuild-architect')?.unlocked).toBe(true);
    expect(byId.get('mystery-clean-tour')?.unlocked).toBe(true);
  });

  it('computes a profile with xp, level and next visible achievement', () => {
    const records = TestBed.inject(PersonalRecordsService);
    const achievements = TestBed.inject(AchievementsService);

    records.saveResult('country-to-flag-easy', { score: 8, maxScore: 10 });
    records.saveResult('flag-to-country-easy', { score: 9, maxScore: 10 });
    TestBed.tick();

    const profile = achievements.profile();

    expect(profile.xp).toBeGreaterThan(0);
    expect(profile.level).toBeGreaterThanOrEqual(1);
    expect(profile.progressPercent).toBeGreaterThanOrEqual(0);
    expect(profile.progressPercent).toBeLessThanOrEqual(100);
    expect(profile.nextAchievement?.hidden).not.toBe(true);
  });

  it('sorts achievements from easy to mystery difficulty', () => {
    const achievements = TestBed.inject(AchievementsService);
    const difficultyOrder = { easy: 0, medium: 1, hard: 2, rare: 3 };
    const difficulties = achievements
      .achievements()
      .map((achievement) => difficultyOrder[achievement.difficulty]);

    expect(difficulties).toEqual([...difficulties].sort((left, right) => left - right));
  });

  it('unlocks advanced and mystery achievements from complete records', () => {
    const records = TestBed.inject(PersonalRecordsService);
    const achievements = TestBed.inject(AchievementsService);
    const recordKeys = [
      'country-to-flag-easy',
      'flag-to-country-easy',
      'shape-to-country-easy',
      'chrono-flags',
      'find-the-error',
      'pixel-flag',
      'flag-rebuild',
    ] as const;

    for (const key of recordKeys) {
      records.saveResult(key, {
        score: key === 'chrono-flags' ? 1600 : 100,
        maxScore: key === 'chrono-flags' ? 1600 : 100,
        percentOverride: 100,
        streak: 20,
      });
    }
    TestBed.tick();

    const byId = new Map(achievements.achievements().map((item) => [item.id, item]));

    expect(byId.get('three-perfect-records')?.unlocked).toBe(true);
    expect(byId.get('all-excellent')?.unlocked).toBe(true);
    expect(byId.get('chrono-expert')?.unlocked).toBe(true);
    expect(byId.get('rebuild-master')?.unlocked).toBe(true);
    expect(byId.get('mystery-seven-perfect')?.unlocked).toBe(true);
  });

  it('merges remote unlocks without exposing invalid achievement ids', () => {
    const achievements = TestBed.inject(AchievementsService);

    achievements.mergeUnlocks({
      'first-game': '2026-01-01T00:00:00.000Z',
      invalid: '2026-01-01T00:00:00.000Z',
    });

    expect(achievements.snapshot()['first-game']).toBe('2026-01-01T00:00:00.000Z');
    expect(achievements.snapshot()['invalid' as never]).toBeUndefined();
  });

  it('keeps the same snapshot when remote unlocks are already present', () => {
    const achievements = TestBed.inject(AchievementsService);
    achievements.mergeUnlocks({
      'first-game': '2026-01-01T00:00:00.000Z',
    });
    const snapshot = achievements.snapshot();

    achievements.mergeUnlocks(snapshot);

    expect(achievements.snapshot()).toBe(snapshot);
  });
});
