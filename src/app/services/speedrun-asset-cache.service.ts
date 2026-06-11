import { Injectable, inject } from '@angular/core';
import { CountrySummary } from '../models/country-summary';
import { SpeedrunQuestion } from '../models/speedrun';
import { BrowserStorageService } from './browser-storage.service';

const FLAG_CACHE_NAME = 'vexiio-speedrun-flags-v1';
const FLAG_CACHE_REFRESH_KEY = 'vexiio.speedrun.flag-cache-refresh.v1';
const FLAG_CACHE_REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const PRELOAD_CONCURRENCY = 6;

@Injectable({ providedIn: 'root' })
export class SpeedrunAssetCacheService {
  private readonly storage = inject(BrowserStorageService);
  private readonly objectUrls = new Set<string>();

  async prepareQuestions(questions: SpeedrunQuestion[]): Promise<SpeedrunQuestion[]> {
    this.releaseRunAssets();
    const requiredUrls = this.collectRequiredFlagUrls(questions);
    const localUrls = await this.loadFlagUrls(requiredUrls);

    return questions.map((question) => ({
      ...question,
      promptCountry: this.replaceCountryFlagUrl(question.promptCountry, localUrls),
      options: question.options.map((country) => this.replaceCountryFlagUrl(country, localUrls)),
    }));
  }

  refreshAllFlagsInBackground(countries: CountrySummary[]): void {
    if (!this.shouldRefreshAllFlags() || countries.length === 0) {
      return;
    }

    void this.refreshAllFlags(countries);
  }

  releaseRunAssets(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }

    this.objectUrls.clear();
  }

  private collectRequiredFlagUrls(questions: SpeedrunQuestion[]): string[] {
    const urls = new Set<string>();

    for (const question of questions) {
      if (question.split.mode === 'flag-to-country') {
        urls.add(question.promptCountry.flagUrl);
      }

      if (question.split.mode === 'country-to-flag') {
        for (const option of question.options) {
          urls.add(option.flagUrl);
        }
      }
    }

    return [...urls].filter(Boolean);
  }

  private async loadFlagUrls(urls: string[]): Promise<Map<string, string>> {
    const entries = await this.mapWithConcurrency(urls, PRELOAD_CONCURRENCY, async (url) => {
      const response = await this.getCachedResponse(url);
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error(`Empty flag asset: ${url}`);
      }

      const objectUrl = URL.createObjectURL(blob);
      this.objectUrls.add(objectUrl);
      await this.decodeImage(objectUrl);
      return [url, objectUrl] as const;
    });

    return new Map(entries);
  }

  private async getCachedResponse(url: string): Promise<Response> {
    if (typeof caches === 'undefined') {
      return this.fetchFlag(url, 'force-cache');
    }

    const cache = await caches.open(FLAG_CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) {
      return cached;
    }

    const response = await this.fetchFlag(url, 'force-cache');
    await cache.put(url, response.clone());
    return response;
  }

  private async refreshAllFlags(countries: CountrySummary[]): Promise<void> {
    try {
      const urls = [...new Set(countries.map((country) => country.flagUrl).filter(Boolean))];
      await this.mapWithConcurrency(urls, PRELOAD_CONCURRENCY, async (url) => {
        const response = await this.fetchFlag(url, 'no-cache');
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(FLAG_CACHE_NAME);
          await cache.put(url, response.clone());
        }
      });
      this.storage.setString(FLAG_CACHE_REFRESH_KEY, new Date().toISOString());
    } catch {
      // Keep the existing cache when a background refresh fails.
    }
  }

  private async fetchFlag(url: string, cacheMode: RequestCache): Promise<Response> {
    const response = await fetch(url, {
      cache: cacheMode,
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`Unable to load flag asset: ${url}`);
    }

    return response;
  }

  private shouldRefreshAllFlags(): boolean {
    const refreshedAt = this.storage.getString(FLAG_CACHE_REFRESH_KEY);
    return (
      !refreshedAt ||
      !Number.isFinite(Date.parse(refreshedAt)) ||
      Date.now() - Date.parse(refreshedAt) >= FLAG_CACHE_REFRESH_INTERVAL_MS
    );
  }

  private async decodeImage(url: string): Promise<void> {
    if (typeof Image === 'undefined') {
      return;
    }

    const image = new Image();
    image.src = url;
    if (typeof image.decode === 'function') {
      await image.decode();
    }
  }

  private replaceCountryFlagUrl(
    country: CountrySummary,
    localUrls: Map<string, string>,
  ): CountrySummary {
    const localUrl = localUrls.get(country.flagUrl);
    return localUrl ? { ...country, flagUrl: localUrl } : country;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, Math.max(items.length, 1)) },
      async () => {
        while (nextIndex < items.length) {
          const index = nextIndex;
          nextIndex += 1;
          results[index] = await mapper(items[index]);
        }
      },
    );

    await Promise.all(workers);
    return results;
  }
}
