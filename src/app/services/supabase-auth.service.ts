import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CLIENT_LOADER } from './supabase-client';

export interface AuthProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

interface OAuthHashTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly loadClient = inject(SUPABASE_CLIENT_LOADER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionState = signal<Session | null>(null);
  private readonly loadingState = signal(true);
  private readonly errorState = signal<string | null>(null);
  private clientPromise: Promise<SupabaseClient> | null = null;
  private authSubscription: { unsubscribe(): void } | null = null;
  private oauthHashTokens: OAuthHashTokens | null = null;

  readonly session = computed(() => this.sessionState());
  readonly user = computed(() => this.sessionState()?.user ?? null);
  readonly profile = computed(() => this.mapUserToProfile(this.user()));
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
  }

  getClient(): Promise<SupabaseClient> {
    this.clientPromise ??= this.loadClient();
    return this.clientPromise;
  }

  private async initializeSession(): Promise<void> {
    const client = await this.getClient();
    const { data: authStateData } = client.auth.onAuthStateChange((event, session) => {
      this.sessionState.set(session);
      this.loadingState.set(false);

      if (event === 'SIGNED_IN' && session?.user) {
        void this.syncUserProfile(session.user);
      }
    });
    this.authSubscription = authStateData.subscription;

    const oauthSession = await this.consumeOAuthHashSession(client);
    if (oauthSession) {
      this.sessionState.set(oauthSession);
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

    const email = user.email ?? '';
    const displayName =
      this.readMetadataString(user, 'full_name') ??
      this.readMetadataString(user, 'name') ??
      email.split('@')[0] ??
      'Joueur';

    return {
      id: user.id,
      email,
      displayName,
      avatarUrl:
        this.readMetadataString(user, 'avatar_url') ?? this.readMetadataString(user, 'picture'),
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
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        locale,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      this.errorState.set(null);
      console.warn('Unable to sync Supabase profile', error);
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
}
