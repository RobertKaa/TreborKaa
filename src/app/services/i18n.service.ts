import { Injectable, computed, signal } from '@angular/core';
import { CountrySummary } from '../models/country-summary';
import { AppLanguage, I18N_TRANSLATIONS } from '../data/i18n-translations';

const LANGUAGE_STORAGE_KEY = 'ftf-language';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly canUseWindow = typeof window !== 'undefined';
  private readonly language = signal<AppLanguage>(this.resolveInitialLanguage());
  readonly currentLanguage = this.language.asReadonly();
  readonly isFrench = computed(() => this.language() === 'fr');
  readonly locale = computed(() => (this.isFrench() ? 'fr-FR' : 'en-US'));

  constructor() {
    this.syncDocumentLanguage();
  }

  setLanguage(language: AppLanguage): void {
    if (this.language() === language) {
      return;
    }

    this.language.set(language);
    this.persistLanguage();
    this.syncDocumentLanguage();
  }

  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.language();
    const primary = I18N_TRANSLATIONS[lang][key];
    const fallback = I18N_TRANSLATIONS.fr[key] ?? I18N_TRANSLATIONS.en[key] ?? key;
    const template = primary ?? fallback;

    if (!params) {
      return template;
    }

    return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
      if (!(token in params)) {
        return '';
      }

      return String(params[token]);
    });
  }

  countryName(country: CountrySummary): string {
    return this.isFrench() ? country.nameFrench : country.nameEnglish;
  }

  capitalName(country: CountrySummary): string {
    return this.isFrench() ? country.capitalFrench : country.capitalEnglish;
  }

  private resolveInitialLanguage(): AppLanguage {
    if (!this.canUseWindow) {
      return 'fr';
    }

    const persisted = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (persisted === 'fr' || persisted === 'en') {
      return persisted;
    }

    const browserLocale = window.navigator.language.toLowerCase();
    return browserLocale.startsWith('fr') ? 'fr' : 'en';
  }

  private persistLanguage(): void {
    if (!this.canUseWindow) {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, this.language());
  }

  private syncDocumentLanguage(): void {
    if (!this.canUseWindow) {
      return;
    }

    document.documentElement.lang = this.language();
  }
}
