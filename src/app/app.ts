import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { XpFeedbackToastComponent } from './components/xp-feedback-toast.component';
import { AppLanguage } from './data/i18n-translations';
import { CountrySummary } from './models/country-summary';
import { AchievementsService } from './services/achievements.service';
import { BrowserStorageService } from './services/browser-storage.service';
import { CountriesService } from './services/countries.service';
import { I18nService } from './services/i18n.service';
import { SupabaseAuthService } from './services/supabase-auth.service';
import { UserDataSyncService } from './services/user-data-sync.service';
import { XpFeedbackService, XpFeedbackSnapshot } from './services/xp-feedback.service';
import {
  DEFAULT_PROFILE_AVATAR_KEY,
  profileAvatarImageUrl,
  readProfileAvatarKey,
  validateProfileDisplayName,
} from './utils/profile-safety';
import type { ProfileAvatarKey } from './utils/profile-safety';

@Component({
  selector: 'app-root',
  host: {
    '[class.theme-dark]': 'isDarkTheme()',
    '[class.mobile-viewport]': 'isMobileViewport()',
    '[class.mobile-landscape]': 'isMobileLandscape()',
    '[class.mobile-keyboard-open]': 'keyboardOffset() > 0',
  },
  imports: [RouterOutlet, RouterLink, RouterLinkActive, XpFeedbackToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(SupabaseAuthService);
  private readonly userDataSync = inject(UserDataSyncService);
  private readonly achievementsService = inject(AchievementsService);
  private readonly xpFeedback = inject(XpFeedbackService);
  private readonly storage = inject(BrowserStorageService);
  private readonly countriesService = inject(CountriesService);
  private readonly canUseWindow = typeof window !== 'undefined';
  private readonly viewportRef = this.canUseWindow ? window.visualViewport : null;
  private readonly prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  private readonly onWindowResize = () => this.updateViewportState();
  private readonly onViewportResize = () => this.updateKeyboardOffset();
  private readonly onOnline = () => this.isOffline.set(false);
  private readonly onOffline = () => this.isOffline.set(true);
  private readonly onGlobalResourceError = (event: Event) => this.handleResourceError(event);
  private achievementToastTimeoutId: number | null = null;
  private previousXpSnapshot: XpFeedbackSnapshot | null = null;
  private readonly xpFeedbackReadyAt = this.canUseWindow ? window.performance.now() + 2500 : 0;

  protected readonly isDarkTheme = signal(this.readInitialTheme());
  protected readonly themeLabel = computed(() =>
    this.isDarkTheme() ? this.i18n.t('theme.light') : this.i18n.t('theme.dark'),
  );
  protected readonly isMobileViewport = signal(false);
  protected readonly isMobileLandscape = signal(false);
  protected readonly isOffline = signal(false);
  protected readonly keyboardOffset = signal(0);
  protected readonly isMenuOpen = signal(false);
  protected readonly isSettingsOpen = signal(false);
  protected readonly isProfileMenuOpen = signal(false);
  protected readonly isProfileSaving = signal(false);
  protected readonly profileFormName = signal('');
  protected readonly profileFormAvatarKey = signal<ProfileAvatarKey>(DEFAULT_PROFILE_AVATAR_KEY);
  protected readonly profileFlagSearch = signal('');
  protected readonly profileFormError = signal<string | null>(null);
  protected readonly profileFormNotice = signal<string | null>(null);
  protected readonly profileCountries = toSignal(this.countriesService.getCountries(), {
    initialValue: [] as CountrySummary[],
  });
  protected readonly selectedProfileCountry = computed(
    () =>
      this.profileCountries().find((country) => country.code === this.profileFormAvatarKey()) ??
      null,
  );
  protected readonly selectedProfileCountryName = computed(() => {
    const country = this.selectedProfileCountry();
    return country ? this.i18n.countryName(country) : this.profileFormAvatarKey().toUpperCase();
  });
  protected readonly profileFlagResults = computed(() => {
    const query = this.normalizeSearch(this.profileFlagSearch());
    const countries = this.sortCountriesByLocale(this.profileCountries());

    if (!query) {
      return countries;
    }

    return countries.filter((country) => this.matchesCountrySearch(country, query));
  });
  protected readonly authProfile = this.auth.profile;
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly isAuthLoading = this.auth.isLoading;
  protected readonly authError = this.auth.lastError;
  protected readonly latestAchievement = this.achievementsService.latestUnlock;
  protected readonly profile = this.achievementsService.profile;
  protected readonly authDisplayName = computed(
    () => this.authProfile()?.displayName ?? this.i18n.t('auth.account'),
  );
  protected readonly authAvatarKey = computed(
    () => this.authProfile()?.avatarKey ?? DEFAULT_PROFILE_AVATAR_KEY,
  );
  protected readonly mobileNotice = computed(() => {
    if (this.isOffline()) {
      return this.i18n.t('mobile.offline');
    }

    if (this.isMobileLandscape()) {
      return this.i18n.t('mobile.landscape');
    }

    return null;
  });

  constructor() {
    effect(() => {
      const profile = this.profile();
      const nextSnapshot = {
        xp: profile.xp,
        level: profile.level,
      };

      if (!this.isXpFeedbackHydrating()) {
        this.xpFeedback.notifyProfileChange(this.previousXpSnapshot, nextSnapshot);
      }

      this.previousXpSnapshot = nextSnapshot;
    });

    effect(() => {
      const latest = this.latestAchievement();
      if (!latest || !this.canUseWindow) {
        return;
      }

      if (this.achievementToastTimeoutId !== null) {
        window.clearTimeout(this.achievementToastTimeoutId);
      }

      this.achievementToastTimeoutId = window.setTimeout(() => {
        this.dismissAchievementToast();
      }, 5200);
    });

    effect(() => {
      const profile = this.authProfile();
      if (!profile || this.isProfileMenuOpen()) {
        return;
      }

      this.profileFormName.set(profile.displayName);
      this.profileFormAvatarKey.set(profile.avatarKey);
    });

    effect(() => {
      if (!this.canUseWindow) {
        return;
      }

      document.documentElement.classList.toggle('theme-dark', this.isDarkTheme());
      document.documentElement.classList.toggle('theme-light', !this.isDarkTheme());
    });

    if (!this.canUseWindow) {
      return;
    }

    this.isOffline.set(!window.navigator.onLine);
    this.updateViewportState();
    this.attachWindowListeners();
  }

  protected toggleTheme(): void {
    this.isDarkTheme.update((value) => !value);
    this.persistTheme();
  }

  protected toggleMenu(): void {
    this.isSettingsOpen.set(false);
    this.isProfileMenuOpen.set(false);
    this.isMenuOpen.update((value) => !value);
  }

  protected toggleSettings(): void {
    this.isMenuOpen.set(false);
    this.isProfileMenuOpen.set(false);
    this.isSettingsOpen.update((value) => !value);
  }

  protected handleAuthButtonClick(): void {
    if (this.isAuthLoading()) {
      return;
    }

    if (this.isAuthenticated()) {
      this.toggleProfileMenu();
      return;
    }

    void this.auth.signInWithGoogle();
  }

  protected toggleProfileMenu(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    this.isMenuOpen.set(false);
    this.isSettingsOpen.set(false);
    this.isProfileMenuOpen.update((value) => {
      const nextValue = !value;
      if (nextValue) {
        this.prepareProfileForm();
      }
      return nextValue;
    });
  }

  protected closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }

  protected signInWithGoogle(): void {
    if (this.isAuthLoading()) {
      return;
    }

    void this.auth.signInWithGoogle();
    this.closeOverlays();
  }

  protected signOut(): void {
    void this.auth.signOut();
    this.closeOverlays();
  }

  protected updateProfileName(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.profileFormName.set(target?.value ?? '');
    this.profileFormError.set(null);
    this.profileFormNotice.set(null);
  }

  protected selectProfileAvatar(key: ProfileAvatarKey): void {
    this.profileFormAvatarKey.set(readProfileAvatarKey(key));
    this.profileFlagSearch.set('');
    this.profileFormError.set(null);
    this.profileFormNotice.set(null);
  }

  protected updateProfileFlagSearch(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.profileFlagSearch.set(target?.value ?? '');
  }

  protected selectProfileCountry(country: CountrySummary): void {
    this.selectProfileAvatar(country.code);
  }

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }

  protected profileAvatarUrl(key: ProfileAvatarKey): string {
    return profileAvatarImageUrl(key);
  }

  protected profileAvatarAlt(key: ProfileAvatarKey): string {
    const country = this.profileCountries().find((entry) => entry.code === readProfileAvatarKey(key));
    return country
      ? this.i18n.t('countries.flagOf', { country: this.i18n.countryName(country) })
      : readProfileAvatarKey(key).toUpperCase();
  }

  protected async saveProfile(): Promise<void> {
    if (this.isProfileSaving()) {
      return;
    }

    const validation = validateProfileDisplayName(this.profileFormName());
    if (validation.value === null) {
      this.profileFormError.set(validation.errorKey);
      this.profileFormNotice.set(null);
      return;
    }
    const displayName = validation.value;

    this.isProfileSaving.set(true);
    this.profileFormError.set(null);
    this.profileFormNotice.set(null);

    try {
      await this.auth.updateProfile({
        displayName,
        avatarKey: this.profileFormAvatarKey(),
      });
      this.profileFormName.set(displayName);
      this.profileFormNotice.set('profile.saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      this.profileFormError.set(message.startsWith('profile.') ? message : 'profile.error.saveFailed');
    } finally {
      this.isProfileSaving.set(false);
    }
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected closeSettings(): void {
    this.isSettingsOpen.set(false);
  }

  protected closeOverlays(): void {
    this.closeMenu();
    this.closeSettings();
    this.closeProfileMenu();
  }

  protected setLanguage(language: AppLanguage): void {
    this.i18n.setLanguage(language);
    this.closeOverlays();
  }

  protected isActiveLanguage(language: AppLanguage): boolean {
    return this.i18n.currentLanguage() === language;
  }

  protected dismissAchievementToast(): void {
    if (this.achievementToastTimeoutId !== null && this.canUseWindow) {
      window.clearTimeout(this.achievementToastTimeoutId);
      this.achievementToastTimeoutId = null;
    }

    this.achievementsService.acknowledgeLatestUnlock();
  }

  ngOnDestroy(): void {
    if (this.canUseWindow) {
      window.removeEventListener('resize', this.onWindowResize);
      window.removeEventListener('orientationchange', this.onWindowResize);
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
      window.removeEventListener('error', this.onGlobalResourceError, true);
      this.viewportRef?.removeEventListener('resize', this.onViewportResize);
      document.documentElement.classList.remove('theme-dark', 'theme-light');

      if (this.achievementToastTimeoutId !== null) {
        window.clearTimeout(this.achievementToastTimeoutId);
        this.achievementToastTimeoutId = null;
      }
    }
  }

  private readInitialTheme(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = this.storage.getString('ftf-theme');
    if (stored === 'dark') {
      return true;
    }

    if (stored === 'light') {
      return false;
    }

    return true;
  }

  private persistTheme(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.storage.setString('ftf-theme', this.isDarkTheme() ? 'dark' : 'light');
  }

  private attachWindowListeners(): void {
    window.addEventListener('resize', this.onWindowResize, { passive: true });
    window.addEventListener('orientationchange', this.onWindowResize, { passive: true });
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('error', this.onGlobalResourceError, true);
    this.viewportRef?.addEventListener('resize', this.onViewportResize, { passive: true });
  }

  private updateViewportState(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width <= 860;

    this.isMobileViewport.set(isMobile);
    this.isMobileLandscape.set(isMobile && width > height && height < 560);

    document.documentElement.style.setProperty('--app-vh', `${height * 0.01}px`);
    this.updateKeyboardOffset();
  }

  private updateKeyboardOffset(): void {
    if (!this.canUseWindow) {
      return;
    }

    const viewportHeight = this.viewportRef?.height ?? window.innerHeight;
    const viewportOffsetTop = this.viewportRef?.offsetTop ?? 0;
    const rawOffset = window.innerHeight - (viewportHeight + viewportOffsetTop);
    const offset = Math.max(0, Math.round(rawOffset));
    const keyboardOffset = offset > 110 ? offset : 0;

    this.keyboardOffset.set(keyboardOffset);
    document.documentElement.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
  }

  private prepareProfileForm(): void {
    const profile = this.authProfile();
    this.profileFormName.set(profile?.displayName ?? '');
    this.profileFormAvatarKey.set(profile?.avatarKey ?? DEFAULT_PROFILE_AVATAR_KEY);
    this.profileFlagSearch.set('');
    this.profileFormError.set(null);
    this.profileFormNotice.set(null);
  }

  private sortCountriesByLocale(countries: CountrySummary[]): CountrySummary[] {
    return [...countries].sort((left, right) =>
      this.i18n.countryName(left).localeCompare(this.i18n.countryName(right), this.i18n.locale()),
    );
  }

  private matchesCountrySearch(country: CountrySummary, query: string): boolean {
    return [
      country.code,
      country.nameFrench,
      country.nameEnglish,
      country.capitalFrench,
      country.capitalEnglish,
    ].some((value) => this.normalizeSearch(value).includes(query));
  }

  private normalizeSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .trim();
  }

  private isXpFeedbackHydrating(): boolean {
    return this.canUseWindow && window.performance.now() < this.xpFeedbackReadyAt;
  }

  private handleResourceError(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    if (target.dataset['ftfFallbackApplied'] === '1') {
      return;
    }

    target.dataset['ftfFallbackApplied'] = '1';
    target.src = this.buildFallbackFlagDataUri();
    const fallbackLabel = this.i18n.t('fallback.unavailable');
    target.alt = target.alt ? `${target.alt} (${fallbackLabel.toLowerCase()})` : fallbackLabel;
  }

  private buildFallbackFlagDataUri(): string {
    const unavailable = this.escapeForSvgText(this.i18n.t('fallback.unavailable'));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-label="${unavailable}">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#dfe6ff"/>
          <stop offset="100%" stop-color="#f3f6ff"/>
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#g)"/>
      <rect x="18" y="18" width="284" height="164" rx="14" fill="none" stroke="#8ca0d1" stroke-width="6" stroke-dasharray="10 8"/>
      <text x="160" y="108" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="20" fill="#41507e">${unavailable}</text>
    </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private escapeForSvgText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
