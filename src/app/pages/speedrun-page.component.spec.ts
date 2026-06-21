import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { buildSpeedrunResult } from '../models/speedrun';
import { BrowserStorageService } from '../services/browser-storage.service';
import { CountriesService } from '../services/countries.service';
import { CountryShapesService } from '../services/country-shapes.service';
import { SpeedrunAssetCacheService } from '../services/speedrun-asset-cache.service';
import { SpeedrunLeaderboardService } from '../services/speedrun-leaderboard.service';
import { SpeedrunRecordsService } from '../services/speedrun-records.service';
import { SpeedrunRunSubmissionService } from '../services/speedrun-run-submission.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { SpeedrunPageComponent } from './speedrun-page.component';
import { vi } from 'vitest';

const PENDING_GUEST_SPEEDRUN_KEY = 'vexiio.speedrun.pendingGuestResult.v1';

describe('SpeedrunPageComponent', () => {
  let fixture: ComponentFixture<SpeedrunPageComponent>;
  let component: SpeedrunPageComponent;
  let storage: BrowserStorageService;
  let records: SpeedrunRecordsService;

  const signInWithGoogle = vi.fn();
  const refreshLeaderboard = vi.fn().mockResolvedValue(undefined);
  const authUser = vi.fn(() => null as { id: string } | null);
  const authProfileSignal = signal<{ id: string; displayName: string; avatarKey: string } | null>(
    null,
  );

  beforeEach(async () => {
    localStorage.clear();
    signInWithGoogle.mockReset().mockResolvedValue(undefined);
    refreshLeaderboard.mockReset().mockResolvedValue(undefined);
    authUser.mockReset().mockReturnValue(null);
    authProfileSignal.set(null);

    await TestBed.configureTestingModule({
      imports: [SpeedrunPageComponent],
      providers: [
        {
          provide: CountriesService,
          useValue: {
            getCountries: () =>
              of([
                {
                  code: 'fr',
                  nameEnglish: 'France',
                  nameFrench: 'France',
                  capitalEnglish: 'Paris',
                  capitalFrench: 'Paris',
                  flagUrl: '/data/flags/fr.png',
                },
                {
                  code: 'de',
                  nameEnglish: 'Germany',
                  nameFrench: 'Allemagne',
                  capitalEnglish: 'Berlin',
                  capitalFrench: 'Berlin',
                  flagUrl: '/data/flags/de.png',
                },
                {
                  code: 'jp',
                  nameEnglish: 'Japan',
                  nameFrench: 'Japon',
                  capitalEnglish: 'Tokyo',
                  capitalFrench: 'Tokyo',
                  flagUrl: '/data/flags/jp.png',
                },
                {
                  code: 'br',
                  nameEnglish: 'Brazil',
                  nameFrench: 'Brésil',
                  capitalEnglish: 'Brasilia',
                  capitalFrench: 'Brasilia',
                  flagUrl: '/data/flags/br.png',
                },
              ]),
          },
        },
        {
          provide: CountryShapesService,
          useValue: {
            getCountryShapes: () =>
              of([
                {
                  code: 'fr',
                  path: 'M0 0',
                  viewBox: '0 0 100 100',
                },
              ]),
          },
        },
        {
          provide: SpeedrunAssetCacheService,
          useValue: {
            refreshAllFlagsInBackground: vi.fn(),
            prepareQuestions: vi.fn(async (questions: unknown[]) => questions),
            releaseRunAssets: vi.fn(),
          },
        },
        {
          provide: SpeedrunRunSubmissionService,
          useValue: {
            startAttempt: vi.fn(),
            submitAttempt: vi.fn(),
          },
        },
        {
          provide: SupabaseAuthService,
          useValue: {
            user: authUser,
            profile: authProfileSignal.asReadonly(),
            isAuthenticated: () => authUser() !== null,
            signInWithGoogle,
          },
        },
        {
          provide: SpeedrunLeaderboardService,
          useValue: {
            refresh: refreshLeaderboard,
            entries: () => [
              {
                userId: 'user-1',
                displayName: 'Ancien pseudo',
                avatarKey: 'fr',
                totalTimeMs: 72_000,
                rawTimeMs: 42_000,
                penaltyMs: 30_000,
                mistakeCount: 1,
                correctCount: 59,
                completedAt: '2026-05-20T10:01:00.000Z',
              },
            ],
            isLoading: () => false,
            error: () => null,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeedrunPageComponent);
    component = fixture.componentInstance;
    storage = TestBed.inject(BrowserStorageService);
    records = TestBed.inject(SpeedrunRecordsService);
    fixture.detectChanges();
  });

  it('stores a guest result and starts Google sign-in when saving after a run', async () => {
    const finalResult = buildSpeedrunResult(42_000, 1, '2026-05-20T10:01:00.000Z');
    (component as any).splitResults.set([]);
    (component as any).result.set(finalResult);

    await (component as any).signInToSaveResult(finalResult);

    expect(storage.getJson(PENDING_GUEST_SPEEDRUN_KEY, null)).toEqual({
      result: finalResult,
      splitResults: [],
      savedAt: expect.any(String),
    });
    expect(signInWithGoogle).toHaveBeenCalled();
  });

  it('restores a pending guest result after the user connects', () => {
    const finalResult = buildSpeedrunResult(38_000, 0, '2026-05-20T10:05:00.000Z');
    storage.setJson(PENDING_GUEST_SPEEDRUN_KEY, {
      result: finalResult,
      splitResults: [],
      savedAt: '2026-05-20T10:05:00.000Z',
    });

    (component as any).consumePendingGuestSpeedrun('user-42');

    expect(records.getBestForUser('user-42')?.totalTimeMs).toBe(finalResult.totalTimeMs);
    expect((component as any).pendingGuestSaveCompleted()).toBe(true);
    expect(storage.getJson(PENDING_GUEST_SPEEDRUN_KEY, null)).toBeNull();
  });

  it('builds leaderboard avatar URLs from avatar_key flag codes', () => {
    const url = (component as any).leaderboardAvatarUrl({
      userId: 'user-1',
      displayName: 'Capitaine Bleu',
      avatarKey: 'jp',
      totalTimeMs: 72_000,
      rawTimeMs: 42_000,
      penaltyMs: 30_000,
      mistakeCount: 1,
      correctCount: 59,
      completedAt: '2026-05-20T10:01:00.000Z',
    });

    expect(url).toBe('/data/flags/jp.png');
  });

  it('overlays the authenticated profile on the current user leaderboard row', () => {
    authUser.mockReturnValue({ id: 'user-1' });
    authProfileSignal.set({
      id: 'user-1',
      displayName: 'Capitaine Bleu',
      avatarKey: 'jp',
    });

    const entries = (component as any).topLeaderboardEntries();

    expect(entries[0]?.displayName).toBe('Capitaine Bleu');
    expect(entries[0]?.avatarKey).toBe('jp');
  });
});
