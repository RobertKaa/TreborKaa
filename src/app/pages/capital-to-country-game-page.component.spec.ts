import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CountrySummary } from '../models/country-summary';
import { CountriesService } from '../services/countries.service';
import { FlagQuizService } from '../services/flag-quiz.service';
import { CapitalToCountryGamePageComponent } from './capital-to-country-game-page.component';

describe('CapitalToCountryGamePageComponent', () => {
  let fixture: ComponentFixture<CapitalToCountryGamePageComponent>;
  let component: CapitalToCountryGamePageComponent;

  const countriesMock: CountrySummary[] = [
    {
      code: 'fr',
      nameEnglish: 'France',
      nameFrench: 'France',
      capitalEnglish: 'Paris',
      capitalFrench: 'Paris',
      flagUrl: 'https://example.com/fr.png',
    },
    {
      code: 'de',
      nameEnglish: 'Germany',
      nameFrench: 'Allemagne',
      capitalEnglish: 'Berlin',
      capitalFrench: 'Berlin',
      flagUrl: 'https://example.com/de.png',
    },
    {
      code: 'it',
      nameEnglish: 'Italy',
      nameFrench: 'Italie',
      capitalEnglish: 'Rome',
      capitalFrench: 'Rome',
      flagUrl: 'https://example.com/it.png',
    },
    {
      code: 'es',
      nameEnglish: 'Spain',
      nameFrench: 'Espagne',
      capitalEnglish: 'Madrid',
      capitalFrench: 'Madrid',
      flagUrl: 'https://example.com/es.png',
    },
    {
      code: 'xx',
      nameEnglish: 'No Capital',
      nameFrench: 'Sans capitale',
      capitalEnglish: '-',
      capitalFrench: '-',
      flagUrl: 'https://example.com/xx.png',
    },
  ];

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [CapitalToCountryGamePageComponent],
      providers: [
        FlagQuizService,
        {
          provide: CountriesService,
          useValue: {
            getCountries: () => of(countriesMock),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CapitalToCountryGamePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('builds a capital question with four country options', () => {
    const question = (component as any).currentQuestion();

    expect(question).toBeTruthy();
    expect(question.options).toHaveLength(4);
    expect(question.options.some((option: CountrySummary) => option.code === 'xx')).toBe(false);
  });

  it('increments score when the correct country is selected', () => {
    const question = (component as any).currentQuestion();
    const initialScore = (component as any).score();

    (component as any).selectAnswer(question.correctCode);

    expect((component as any).score()).toBe(initialScore + 1);
    expect((component as any).answered()).toBe(true);
  });

  it('records a mistake when a wrong country is selected', () => {
    const question = (component as any).currentQuestion();
    const wrongCode = question.options.find(
      (option: CountrySummary) => option.code !== question.correctCode,
    )?.code;

    expect(wrongCode).toBeTruthy();

    (component as any).selectAnswer(wrongCode);

    expect((component as any).wrongAttempts()).toBe(1);
    expect((component as any).errors()).toHaveLength(1);
  });
});
