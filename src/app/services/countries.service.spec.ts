import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CountrySummary } from '../models/country-summary';
import { CountriesService } from './countries.service';

const CACHE_KEY = 'vexiio.countries-cache.v2';

describe('CountriesService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('uses a recent complete local cache without making a network request', () => {
    const countries = Array.from({ length: 180 }, (_, index) => country(index));
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: 2,
        refreshedAt: new Date().toISOString(),
        countries,
      }),
    );
    const service = TestBed.inject(CountriesService);
    const http = TestBed.inject(HttpTestingController);
    let result: CountrySummary[] = [];

    service.getCountries().subscribe((value) => {
      result = value;
    });

    expect(result).toEqual(countries);
    http.expectNone(() => true);
  });
});

function country(index: number): CountrySummary {
  const code = index.toString(36).padStart(2, '0').slice(-2);
  return {
    code,
    nameEnglish: `Country ${index}`,
    nameFrench: `Pays ${index}`,
    capitalEnglish: `Capital ${index}`,
    capitalFrench: `Capitale ${index}`,
    flagUrl: `/data/flags/${code}.png`,
  };
}
