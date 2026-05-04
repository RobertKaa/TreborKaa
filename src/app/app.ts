import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AppLanguage } from './data/i18n-translations';
import { AchievementsService } from './services/achievements.service';
import { BrowserStorageService } from './services/browser-storage.service';
import { I18nService } from './services/i18n.service';
import { SupabaseAuthService } from './services/supabase-auth.service';
import { UserDataSyncService } from './services/user-data-sync.service';

@Component({
  selector: 'app-root',
  host: {
    '[class.theme-dark]': 'isDarkTheme()',
    '[class.mobile-viewport]': 'isMobileViewport()',
    '[class.mobile-landscape]': 'isMobileLandscape()',
    '[class.mobile-keyboard-open]': 'keyboardOffset() > 0',
  },
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(SupabaseAuthService);
  private readonly userDataSync = inject(UserDataSyncService);
  private readonly achievementsService = inject(AchievementsService);
  private readonly storage = inject(BrowserStorageService);
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

  protected readonly isDarkTheme = signal(this.readInitialTheme());
  protected readonly themeLabel = computed(() =>
    this.isDarkTheme() ? this.i18n.t('theme.light') : this.i18n.t('theme.dark'),
  );
  protected readonly isMobileViewport = signal(false);
  protected readonly isMobileLandscape = signal(false);
  protected readonly isOffline = signal(false);
  protected readonly keyboardOffset = signal(0);
  protected readonly isMenuOpen = signal(false);
  protected readonly authProfile = this.auth.profile;
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly isAuthLoading = this.auth.isLoading;
  protected readonly authError = this.auth.lastError;
  protected readonly latestAchievement = this.achievementsService.latestUnlock;
  protected readonly authDisplayName = computed(
    () => this.authProfile()?.displayName ?? this.i18n.t('auth.account'),
  );
  protected readonly authInitial = computed(() => {
    const displayName = this.authDisplayName().trim();
    return (displayName.charAt(0) || 'V').toUpperCase();
  });
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
    this.isMenuOpen.update((value) => !value);
  }

  protected handleAuthButtonClick(): void {
    if (this.isAuthLoading()) {
      return;
    }

    if (this.isAuthenticated()) {
      this.toggleMenu();
      return;
    }

    void this.auth.signInWithGoogle();
  }

  protected signInWithGoogle(): void {
    if (this.isAuthLoading()) {
      return;
    }

    void this.auth.signInWithGoogle();
    this.closeMenu();
  }

  protected signOut(): void {
    void this.auth.signOut();
    this.closeMenu();
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected setLanguage(language: AppLanguage): void {
    this.i18n.setLanguage(language);
    this.closeMenu();
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

      if (this.achievementToastTimeoutId !== null) {
        window.clearTimeout(this.achievementToastTimeoutId);
        this.achievementToastTimeoutId = null;
      }
    }
  }

  private readInitialTheme(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const stored = this.storage.getString('ftf-theme');
    if (stored === 'dark') {
      return true;
    }

    if (stored === 'light') {
      return false;
    }

    return this.prefersDark;
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
