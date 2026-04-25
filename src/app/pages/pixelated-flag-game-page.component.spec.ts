import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CountriesService } from '../services/countries.service';
import { PixelatedFlagGamePageComponent } from './pixelated-flag-game-page.component';

describe('PixelatedFlagGamePageComponent', () => {
  let fixture: ComponentFixture<PixelatedFlagGamePageComponent>;
  let component: PixelatedFlagGamePageComponent;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  const countriesMock = [
    {
      code: 'fr',
      nameEnglish: 'France',
      nameFrench: 'France',
      capitalEnglish: 'Paris',
      capitalFrench: 'Paris',
      flagUrl: 'https://example.com/fr.png'
    },
    {
      code: 'de',
      nameEnglish: 'Germany',
      nameFrench: 'Allemagne',
      capitalEnglish: 'Berlin',
      capitalFrench: 'Berlin',
      flagUrl: 'https://example.com/de.png'
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    await TestBed.configureTestingModule({
      imports: [PixelatedFlagGamePageComponent],
      providers: [
        {
          provide: CountriesService,
          useValue: {
            getCountries: () => of(countriesMock)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PixelatedFlagGamePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('accepts a correct answer and marks round as correct', () => {
    const currentCountry = countriesMock[0];
    (component as any).isLoading.set(false);
    (component as any).isLocked.set(false);
    (component as any).isComplete.set(false);
    (component as any).currentCountry.set(currentCountry);
    (component as any).answer.set('France');

    (component as any).submitAnswer();

    expect((component as any).roundResult()).toBe('correct');
    expect((component as any).solvedCount()).toBe(1);
    expect((component as any).score()).toBeGreaterThan(0);
  });

  it('marks game complete after max wrong attempts', () => {
    const currentCountry = countriesMock[0];
    (component as any).isLoading.set(false);
    (component as any).isLocked.set(false);
    (component as any).isComplete.set(false);
    (component as any).currentCountry.set(currentCountry);
    (component as any).attemptsUsed.set(4);
    (component as any).answer.set('mauvaise reponse');

    (component as any).submitAnswer();

    expect((component as any).isComplete()).toBe(true);
    expect((component as any).roundResult()).toBe('wrong');
    expect((component as any).errors().length).toBe(1);
  });

  it('restarts game when closing summary', () => {
    (component as any).score.set(12);
    (component as any).solvedCount.set(3);
    (component as any).isComplete.set(true);

    (component as any).closeSummary();

    expect((component as any).isComplete()).toBe(false);
    expect((component as any).score()).toBe(0);
    expect((component as any).solvedCount()).toBe(0);
  });
});
