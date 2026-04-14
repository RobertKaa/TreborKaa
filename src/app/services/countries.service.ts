import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { resolveFlagUrl, resolveRemoteFlagUrl } from '../config/flag-source.config';
import { COUNTRIES } from '../data/countries';
import { CAPITAL_LOCALIZATIONS_FR } from '../data/capital-localizations.fr';
import { CountrySummary } from '../models/country-summary';

const EXCLUDED_TERRITORY_CODES = new Set([
  'ax', // Åland
  'bq', // Pays-Bas caribéens
  'bv', // Île Bouvet
  'hm', // Îles Heard-et-MacDonald
  'sj', // Svalbard et Jan Mayen
  'um' // Îles mineures éloignées des États-Unis
]);
const CAPITAL_OVERRIDES_EN: Record<string, string> = {
  mo: 'Macau'
};
const COUNTRY_NAME_OVERRIDES_FR: Record<string, string> = {
  cd: 'République démocratique du Congo',
  mo: 'Macao',
  pw: 'Palaos'
};

type RestCountryItem = {
  cca2?: string;
  capital?: string[];
  flags?: {
    png?: string;
    svg?: string;
  };
  name?: {
    common?: string;
  };
  translations?: {
    fra?: {
      common?: string;
    };
  };
};

@Injectable({ providedIn: 'root' })
export class CountriesService {
  private readonly http = inject(HttpClient);
  private readonly endpoint =
    'https://restcountries.com/v3.1/all?fields=name,translations,capital,cca2,flags';

  getCountries(): Observable<CountrySummary[]> {
    return this.http.get<RestCountryItem[]>(this.endpoint).pipe(
      map((countries) =>
        countries
          .map((country) => {
            const code = country.cca2?.toLowerCase() ?? '';
            const nameEnglish = country.name?.common?.trim() ?? '';
            const capitalEnglish =
              country.capital?.[0]?.trim() ?? CAPITAL_OVERRIDES_EN[code] ?? '-';

            return {
              code,
              nameEnglish,
              nameFrench:
                COUNTRY_NAME_OVERRIDES_FR[code] ??
                country.translations?.fra?.common?.trim() ??
                nameEnglish,
              capitalEnglish,
              capitalFrench: this.localizeCapital(capitalEnglish),
              flagUrl: code ? resolveRemoteFlagUrl(code) : country.flags?.png ?? country.flags?.svg ?? ''
            };
          })
          .filter(
            (country) =>
              country.code &&
              country.nameEnglish &&
              country.flagUrl &&
              !EXCLUDED_TERRITORY_CODES.has(country.code)
          )
          .sort((left, right) => left.nameFrench.localeCompare(right.nameFrench, 'fr'))
      ),
      catchError(() => of(this.getFallbackCountries()))
    );
  }

  private getFallbackCountries(): CountrySummary[] {
    return COUNTRIES
      .map((country) => ({
        code: country.code,
        nameEnglish: country.name,
        nameFrench:
          COUNTRY_NAME_OVERRIDES_FR[country.code] ??
          this.localizeCountryName(country.code, country.name),
        capitalEnglish: country.capital,
        capitalFrench: this.localizeCapital(country.capital),
        flagUrl: resolveFlagUrl(country)
      }))
      .filter((country) => !EXCLUDED_TERRITORY_CODES.has(country.code))
      .sort((left, right) => left.nameFrench.localeCompare(right.nameFrench, 'fr'));
  }

  private localizeCountryName(code: string, fallbackName: string): string {
    try {
      return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code.toUpperCase()) ?? fallbackName;
    } catch {
      return fallbackName;
    }
  }

  private localizeCapital(capitalEnglish: string): string {
    return CAPITAL_LOCALIZATIONS_FR[capitalEnglish.toLowerCase()] ?? capitalEnglish;
  }
}

