import { TestBed } from '@angular/core/testing';
import { CountrySummary } from '../models/country-summary';
import { FlagQuizService } from './flag-quiz.service';

describe('FlagQuizService capital mode', () => {
  let service: FlagQuizService;

  const countries: CountrySummary[] = [
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FlagQuizService],
    });
    service = TestBed.inject(FlagQuizService);
  });

  it('filters countries without a valid capital', () => {
    const filtered = service.filterCapitalCountries(countries);

    expect(filtered).toHaveLength(4);
    expect(filtered.some((country) => country.code === 'xx')).toBe(false);
  });

  it('builds capital-to-country questions from the capital pool only', () => {
    const question = service.buildCapitalToCountryQuestion(countries, 'easy');

    expect(question.options).toHaveLength(4);
    expect(question.options.every((option) => option.code !== 'xx')).toBe(true);
    expect(question.correctCode).toBe(question.promptCountry.code);
  });
});
