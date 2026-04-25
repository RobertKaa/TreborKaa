import { TestBed } from '@angular/core/testing';
import { FavoriteGamesService } from './favorite-games.service';

describe('FavoriteGamesService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('toggles and persists favorites', () => {
    const service = TestBed.inject(FavoriteGamesService);
    expect(service.count()).toBe(0);

    service.toggle('flag-chrono');
    expect(service.isFavorite('flag-chrono')).toBe(true);
    expect(service.count()).toBe(1);

    service.toggle('flag-chrono');
    expect(service.isFavorite('flag-chrono')).toBe(false);
    expect(service.count()).toBe(0);
  });

  it('loads only valid ids from storage', () => {
    localStorage.setItem(
      'vexiio.favorites.v1',
      JSON.stringify({
        'flag-chrono': true,
        'invalid-game': true,
        'classic-country-to-flag-easy': false
      })
    );

    const service = TestBed.inject(FavoriteGamesService);
    expect(service.isFavorite('flag-chrono')).toBe(true);
    expect(service.ids()).toEqual(['flag-chrono']);
  });
});

