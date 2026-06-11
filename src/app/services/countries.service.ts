import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, concat, defer, map, of, shareReplay, tap } from 'rxjs';
import { resolveFlagUrl, resolveLocalFlagUrl } from '../config/flag-source.config';
import { CAPITAL_LOCALIZATIONS_FR } from '../data/capital-localizations.fr';
import { COUNTRIES } from '../data/countries';
import { CountrySummary } from '../models/country-summary';
import { BrowserStorageService } from './browser-storage.service';

const EXCLUDED_TERRITORY_CODES = new Set([
  'ax', // Åland
  'bq', // Pays-Bas caribéens
  'bv', // Île Bouvet
  'hm', // Îles Heard-et-MacDonald
  'mf', // Saint-Martin (doublon drapeau France)
  'sj', // Svalbard et Jan Mayen
  'um', // Îles mineures éloignées des États-Unis
]);
const CAPITAL_OVERRIDES_EN: Record<string, string> = {
  mo: 'Macau',
};
const COUNTRY_NAME_OVERRIDES_FR: Record<string, string> = {
  cd: 'République démocratique du Congo',
  mo: 'Macao',
  pw: 'Palaos',
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

type CountriesCache = {
  version: number;
  refreshedAt: string;
  countries: CountrySummary[];
};

const COUNTRIES_CACHE_KEY = 'vexiio.countries-cache.v2';
const COUNTRIES_CACHE_VERSION = 2;
const COUNTRIES_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MINIMUM_COMPLETE_COUNTRY_COUNT = 180;
const LOCAL_SNAPSHOT_URL = 'data/rest-countries.snapshot.json';
const REMOTE_DATASET_URL =
  'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

@Injectable({ providedIn: 'root' })
export class CountriesService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(BrowserStorageService);
  private readonly countries$ = defer(() => this.buildCountriesStream()).pipe(
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  getCountries(): Observable<CountrySummary[]> {
    return this.countries$;
  }

  private buildCountriesStream(): Observable<CountrySummary[]> {
    const cache = this.readCache();
    const initial$ = cache
      ? of(cache.countries)
      : this.http.get<RestCountryItem[]>(LOCAL_SNAPSHOT_URL).pipe(
          map((countries) => this.normalizeCountries(countries)),
          catchError(() => of(this.getFallbackCountries())),
        );
    const refresh$ = this.shouldRefresh(cache)
      ? this.http.get<RestCountryItem[]>(REMOTE_DATASET_URL).pipe(
          map((countries) => this.normalizeCountries(countries)),
          tap((countries) => this.persistCache(countries)),
          catchError(() => EMPTY),
        )
      : EMPTY;

    return concat(initial$, refresh$);
  }

  private normalizeCountries(countries: RestCountryItem[]): CountrySummary[] {
    return countries
      .map((country) => {
        const code = country.cca2?.toLowerCase() ?? '';
        const nameEnglish = country.name?.common?.trim() ?? '';
        const capitalEnglish = country.capital?.[0]?.trim() ?? CAPITAL_OVERRIDES_EN[code] ?? '-';

        return {
          code,
          nameEnglish,
          nameFrench:
            COUNTRY_NAME_OVERRIDES_FR[code] ??
            country.translations?.fra?.common?.trim() ??
            nameEnglish,
          capitalEnglish,
          capitalFrench: this.localizeCapital(capitalEnglish),
          flagUrl: code
            ? resolveLocalFlagUrl(code)
            : (country.flags?.png ?? country.flags?.svg ?? ''),
        };
      })
      .filter(
        (country) =>
          country.code &&
          country.nameEnglish &&
          country.flagUrl &&
          !EXCLUDED_TERRITORY_CODES.has(country.code),
      )
      .sort((left, right) => left.nameFrench.localeCompare(right.nameFrench, 'fr'));
  }

  private readCache(): CountriesCache | null {
    const cache = this.storage.getJson<CountriesCache | null>(COUNTRIES_CACHE_KEY, null);
    if (
      !cache ||
      cache.version !== COUNTRIES_CACHE_VERSION ||
      !Array.isArray(cache.countries) ||
      cache.countries.length < MINIMUM_COMPLETE_COUNTRY_COUNT ||
      !Number.isFinite(Date.parse(cache.refreshedAt))
    ) {
      return null;
    }

    return cache;
  }

  private shouldRefresh(cache: CountriesCache | null): boolean {
    if (!cache) {
      return true;
    }

    return Date.now() - Date.parse(cache.refreshedAt) >= COUNTRIES_REFRESH_INTERVAL_MS;
  }

  private persistCache(countries: CountrySummary[]): void {
    if (countries.length < MINIMUM_COMPLETE_COUNTRY_COUNT) {
      return;
    }

    this.storage.setJson<CountriesCache>(COUNTRIES_CACHE_KEY, {
      version: COUNTRIES_CACHE_VERSION,
      refreshedAt: new Date().toISOString(),
      countries,
    });
  }

  private getFallbackCountries(): CountrySummary[] {
    return COUNTRIES.map((country) => ({
      code: country.code,
      nameEnglish: country.name,
      nameFrench:
        COUNTRY_NAME_OVERRIDES_FR[country.code] ??
        this.localizeCountryName(country.code, country.name),
      capitalEnglish: country.capital,
      capitalFrench: this.localizeCapital(country.capital),
      flagUrl: resolveFlagUrl(country),
    }))
      .filter((country) => !EXCLUDED_TERRITORY_CODES.has(country.code))
      .sort((left, right) => left.nameFrench.localeCompare(right.nameFrench, 'fr'));
  }

  private localizeCountryName(code: string, fallbackName: string): string {
    try {
      return (
        new Intl.DisplayNames(['fr'], { type: 'region' }).of(code.toUpperCase()) ?? fallbackName
      );
    } catch {
      return fallbackName;
    }
  }

  private localizeCapital(capitalEnglish: string): string {
    return CAPITAL_LOCALIZATIONS_FR[capitalEnglish.toLowerCase()] ?? capitalEnglish;
  }
}
