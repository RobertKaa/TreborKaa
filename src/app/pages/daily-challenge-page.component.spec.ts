import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CountryShape } from '../models/country-shape';
import { CountrySummary } from '../models/country-summary';
import { CountriesService } from '../services/countries.service';
import { CountryShapesService } from '../services/country-shapes.service';
import { DailyChallengeService } from '../services/daily-challenge.service';
import { DailyChallengePageComponent } from './daily-challenge-page.component';

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

describe('DailyChallengePageComponent', () => {
  let fixture: ComponentFixture<DailyChallengePageComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [DailyChallengePageComponent],
      providers: [
        provideRouter([]),
        DailyChallengeService,
        {
          provide: CountriesService,
          useValue: { getCountries: () => of(countries) },
        },
        {
          provide: CountryShapesService,
          useValue: { getCountryShapes: () => of(shapes) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DailyChallengePageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the compact streak chip without bonus styling on day one', () => {
    const html = fixture.nativeElement as HTMLElement;
    const chip = html.querySelector('.daily-streak-chip');

    expect(chip).toBeTruthy();
    expect(chip?.classList.contains('has-bonus')).toBe(false);
    expect(chip?.textContent).toMatch(/1/);
    expect(html.querySelector('.daily-streak-broken')).toBeNull();
  });

  it('shows the streak chip with bonus styling when a streak is active', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);
    dailyChallenge.mergeRemoteCompletions({
      '2026-05-21': '2026-05-21T12:00:00.000Z',
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const chip = html.querySelector('.daily-streak-chip');

    expect(chip?.classList.contains('has-bonus')).toBe(true);
    expect(chip?.textContent).toMatch(/\+/);
    expect(dailyChallenge.today().streakBonus).toBeGreaterThan(0);
  });

  it('shows the broken streak notice when the previous day was missed', () => {
    const dailyChallenge = TestBed.inject(DailyChallengeService);
    dailyChallenge.mergeRemoteCompletions({
      '2026-05-20': '2026-05-20T12:00:00.000Z',
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.daily-streak-broken')).toBeTruthy();
    expect(html.querySelector('.daily-streak-chip')?.classList.contains('has-bonus')).toBe(false);
  });
});
