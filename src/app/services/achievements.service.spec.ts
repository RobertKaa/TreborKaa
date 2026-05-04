import { TestBed } from '@angular/core/testing';
import { AchievementsService } from './achievements.service';
import { FavoriteGamesService } from './favorite-games.service';
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

  it('unlocks three-favorites and resume-ready on main actions', () => {
    const favorites = TestBed.inject(FavoriteGamesService);
    const progress = TestBed.inject(GameProgressService);
    const achievements = TestBed.inject(AchievementsService);

    favorites.set('flag-chrono', true);
    favorites.set('pixel-flag', true);
    favorites.set('flag-rebuild', true);
    progress.saveProgress(
      'pixel-flag',
      { score: 5 },
      { percent: 55, labelKey: 'home.resume.pixel' },
    );
    TestBed.tick();

    const threeFavorites = achievements
      .achievements()
      .find((item) => item.id === 'three-favorites');
    const resumeReady = achievements.achievements().find((item) => item.id === 'resume-ready');

    expect(threeFavorites?.unlocked).toBe(true);
    expect(resumeReady?.unlocked).toBe(true);
  });

  it('unlocks global and mystery achievements from records and favorites', () => {
    const records = TestBed.inject(PersonalRecordsService);
    const favorites = TestBed.inject(FavoriteGamesService);
    const achievements = TestBed.inject(AchievementsService);

    records.saveResult('country-to-flag-hard', { score: 10, maxScore: 10, streak: 10 });
    records.saveResult('flag-to-country-hard', { score: 10, maxScore: 10 });
    records.saveResult('shape-to-country-hard', { score: 10, maxScore: 10 });
    records.saveResult('chrono-flags', {
      score: 950,
      maxScore: 950,
      percentOverride: 95,
      streak: 8,
    });
    records.saveResult('find-the-error', { score: 8, maxScore: 10, percentOverride: 80 });
    records.saveResult('pixel-flag', { score: 8, maxScore: 10, percentOverride: 80 });
    records.saveResult('flag-rebuild', { score: 800, maxScore: 1000, percentOverride: 80 });
    favorites.set('find-the-error', true);
    favorites.set('pixel-flag', true);
    favorites.set('flag-rebuild', true);
    TestBed.tick();

    const byId = new Map(achievements.achievements().map((item) => [item.id, item]));

    expect(byId.get('hard-mode-ace')?.unlocked).toBe(true);
    expect(byId.get('visual-trio')?.unlocked).toBe(true);
    expect(byId.get('chrono-sprinter')?.unlocked).toBe(true);
    expect(byId.get('rebuild-architect')?.unlocked).toBe(true);
    expect(byId.get('mystery-visual-curator')?.unlocked).toBe(true);
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

  it('merges remote unlocks without exposing invalid achievement ids', () => {
    const achievements = TestBed.inject(AchievementsService);

    achievements.mergeUnlocks({
      'first-game': '2026-01-01T00:00:00.000Z',
      invalid: '2026-01-01T00:00:00.000Z',
    });

    expect(achievements.snapshot()['first-game']).toBe('2026-01-01T00:00:00.000Z');
    expect(achievements.snapshot()['invalid' as never]).toBeUndefined();
  });
});
