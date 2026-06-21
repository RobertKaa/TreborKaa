import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { GAME_CATALOG } from '../data/game-catalog';
import { SpeedrunLeaderboardService } from '../services/speedrun-leaderboard.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  let component: HomePageComponent;
  const refresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    localStorage.clear();
    refresh.mockClear();

    await TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: SpeedrunLeaderboardService,
          useValue: {
            refresh,
            entries: () => [],
          },
        },
        {
          provide: SupabaseAuthService,
          useValue: {
            user: signal(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists every available game on the dashboard without a show-all toggle', () => {
    const availableCount = GAME_CATALOG.filter((game) => game.available).length;

    expect((component as any).displayedGamesCount()).toBe(availableCount);

    const secondaryIds = new Set(
      (component as any).displayedSecondaryGames().map((game: { id: string }) => game.id),
    );
    expect(secondaryIds.has('find-the-error')).toBe(true);
    expect(secondaryIds.has('pixel-flag')).toBe(true);

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelectorAll('.mode-grid .mode-card').length).toBe(availableCount);
  });

  it('refreshes the speedrun leaderboard for the home rank badge', () => {
    expect(refresh).toHaveBeenCalledWith(100);
  });
});
