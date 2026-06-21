import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { logger } from './logger.service';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  DEFAULT_PROFILE_AVATAR_KEY,
  buildDefaultPublicDisplayName,
  readProfileAvatarKey,
  sanitizeProfileDisplayName,
  validateProfileDisplayName,
} from '../utils/profile-safety';
import type { ProfileAvatarKey } from '../utils/profile-safety';
import { SUPABASE_CLIENT_LOADER } from './supabase-client';

export interface AuthProfile {
  id: string;
  displayName: string;
  avatarKey: ProfileAvatarKey;
}

export type ProfileUpdatePayload = {
  displayName: string;
  avatarKey: ProfileAvatarKey;
};

interface OAuthHashTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly loadClient = inject(SUPABASE_CLIENT_LOADER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionState = signal<Session | null>(null);
  private readonly profileState = signal<AuthProfile | null>(null);
  private readonly loadingState = signal(true);
  private readonly errorState = signal<string | null>(null);
  private clientPromise: Promise<SupabaseClient> | null = null;
  private authSubscription: { unsubscribe(): void } | null = null;
  private oauthHashTokens: OAuthHashTokens | null = null;

  readonly session = computed(() => this.sessionState());
  readonly user = computed(() => this.sessionState()?.user ?? null);
  readonly profile = computed(() => this.profileState() ?? this.mapUserToProfile(this.user()));
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isLoading = computed(() => this.loadingState());
  readonly lastError = computed(() => this.errorState());

  constructor() {
    this.oauthHashTokens = this.readAndCleanOAuthHashTokens();
    void this.initializeSession();
    this.destroyRef.onDestroy(() => this.authSubscription?.unsubscribe());
  }

  async signInWithGoogle(): Promise<void> {
    this.errorState.set(null);

    const client = await this.getClient();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: this.buildRedirectUrl(),
      },
    });

    if (error) {
      this.errorState.set(error.message);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    this.errorState.set(null);

    const client = await this.getClient();
    const { error } = await client.auth.signOut();
    if (error) {
      this.errorState.set(error.message);
      throw error;
    }

    this.sessionState.set(null);
    this.profileState.set(null);
  }

  async updateProfile(payload: ProfileUpdatePayload): Promise<void> {
    this.errorState.set(null);

    const user = this.user();
    if (!user) {
      throw new Error('profile.error.notAuthenticated');
    }

    const displayNameResult = validateProfileDisplayName(payload.displayName);
    if (displayNameResult.errorKey) {
      throw new Error(displayNameResult.errorKey);
    }

    const avatarKey = readProfileAvatarKey(payload.avatarKey);
    const client = await this.getClient();
    const { data, error } = await client.auth.updateUser({
      data: {
        vexiio_display_name: displayNameResult.value,
        vexiio_avatar_key: avatarKey,
      },
    });

    if (error) {
      this.errorState.set(error.message);
      throw error;
    }

    const nextUser = data.user ?? {
      ...user,
      user_metadata: {
        ...user.user_metadata,
        vexiio_display_name: displayNameResult.value,
        vexiio_avatar_key: avatarKey,
      },
    };

    this.applyUserToCurrentSession(nextUser);
    await this.syncUserProfile(nextUser);
  }

  getClient(): Promise<SupabaseClient> {
    this.clientPromise ??= this.loadClient();
    return this.clientPromise;
  }

  private async initializeSession(): Promise<void> {
    const client = await this.getClient();
    const { data: authStateData } = client.auth.onAuthStateChange((event, session) => {
      this.sessionState.set(session);
      this.profileState.set(this.mapUserToProfile(session?.user ?? null));
      this.loadingState.set(false);

      if (event === 'SIGNED_IN' && session?.user) {
        void this.syncUserProfile(session.user);
      }
    });
    this.authSubscription = authStateData.subscription;

    const oauthSession = await this.consumeOAuthHashSession(client);
    if (oauthSession) {
      this.sessionState.set(oauthSession);
      this.profileState.set(this.mapUserToProfile(oauthSession.user));
      this.loadingState.set(false);
      void this.syncUserProfile(oauthSession.user);
      return;
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      this.errorState.set(error.message);
      this.loadingState.set(false);
      return;
    }

    this.sessionState.set(data.session);
    this.profileState.set(this.mapUserToProfile(data.session?.user ?? null));
    this.loadingState.set(false);

    if (data.session?.user) {
      void this.syncUserProfile(data.session.user);
    }
  }

  private buildRedirectUrl(): string {
    if (typeof window === 'undefined') {
      return 'https://vexiio.com/';
    }

    return `${window.location.origin}${window.location.pathname}`;
  }

  private async consumeOAuthHashSession(client: SupabaseClient): Promise<Session | null> {
    if (!this.oauthHashTokens) {
      return null;
    }

    const { accessToken, refreshToken } = this.oauthHashTokens;
    this.oauthHashTokens = null;

    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      this.errorState.set(error.message);
      return null;
    }

    return data.session;
  }

  private readAndCleanOAuthHashTokens(): OAuthHashTokens | null {
    if (typeof window === 'undefined' || !window.location.hash.includes('access_token=')) {
      return null;
    }

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    this.cleanUrlHash();

    if (!accessToken || !refreshToken) {
      this.errorState.set('Session OAuth incomplete.');
      return null;
    }

    return { accessToken, refreshToken };
  }

  private cleanUrlHash(): void {
    if (typeof window === 'undefined' || typeof window.history.replaceState !== 'function') {
      return;
    }

    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, document.title, cleanUrl);
  }

  private mapUserToProfile(user: User | null): AuthProfile | null {
    if (!user) {
      return null;
    }

    const displayName = this.readCustomDisplayName(user) ?? buildDefaultPublicDisplayName(user.id);
    const avatarKey = readProfileAvatarKey(this.readMetadataString(user, 'vexiio_avatar_key'));

    return {
      id: user.id,
      displayName,
      avatarKey,
    };
  }

  private async syncUserProfile(user: User): Promise<void> {
    const profile = this.mapUserToProfile(user);
    if (!profile) {
      return;
    }

    const locale =
      typeof navigator !== 'undefined' && navigator.language
        ? navigator.language.slice(0, 12)
        : null;

    const client = await this.getClient();
    const { error } = await client.from('user_profiles').upsert(
      {
        user_id: profile.id,
        display_name: this.readCustomDisplayName(user) ?? buildDefaultPublicDisplayName(profile.id),
        avatar_key: profile.avatarKey,
        locale,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      this.errorState.set(null);
      logger.warn('Unable to sync Supabase profile', error);
    }
  }

  private readMetadataString(user: User, key: string): string | null {
    const value = user.user_metadata?.[key];
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readCustomDisplayName(user: User): string | null {
    return sanitizeProfileDisplayName(user.user_metadata?.['vexiio_display_name']);
  }

  private applyUserToCurrentSession(user: User): void {
    const currentSession = this.sessionState();
    if (currentSession) {
      this.sessionState.set({
        ...currentSession,
        user,
      });
    }

    this.profileState.set(this.mapUserToProfile(user) ?? {
      id: user.id,
      displayName: buildDefaultPublicDisplayName(user.id),
      avatarKey: DEFAULT_PROFILE_AVATAR_KEY,
    });
  }
}
