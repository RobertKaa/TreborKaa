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
    progress.saveProgress('pixel-flag', { score: 5 }, { percent: 55, labelKey: 'home.resume.pixel' });
    TestBed.tick();

    const threeFavorites = achievements.achievements().find((item) => item.id === 'three-favorites');
    const resumeReady = achievements.achievements().find((item) => item.id === 'resume-ready');

    expect(threeFavorites?.unlocked).toBe(true);
    expect(resumeReady?.unlocked).toBe(true);
  });
});
