import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { SupabaseAuthService } from './supabase-auth.service';
import { SUPABASE_CLIENT_LOADER } from './supabase-client';

describe('SupabaseAuthService', () => {
  const unsubscribe = vi.fn();
  const getSession = vi.fn();
  const setSession = vi.fn();
  const signInWithOAuth = vi.fn();
  const signOut = vi.fn();
  const updateUser = vi.fn();
  const upsert = vi.fn();
  const from = vi.fn();

  beforeEach(() => {
    unsubscribe.mockReset();
    getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    setSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null });
    signOut.mockReset().mockResolvedValue({ error: null });
    updateUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
    upsert.mockReset().mockResolvedValue({ error: null });
    from.mockReset().mockReturnValue({ upsert });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPABASE_CLIENT_LOADER,
          useValue: async () =>
            ({
              auth: {
                getSession,
                setSession,
                onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
                signInWithOAuth,
                signOut,
                updateUser,
              },
              from,
            }) as unknown as SupabaseClient,
        },
      ],
    });
  });

  it('starts the Google OAuth flow with the current route as redirect', async () => {
    const service = TestBed.inject(SupabaseAuthService);

    await service.signInWithGoogle();

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
  });

  it('clears the local session on sign out', async () => {
    const service = TestBed.inject(SupabaseAuthService);

    await service.signOut();

    expect(signOut).toHaveBeenCalled();
    expect(service.user()).toBeNull();
  });

  it('consumes OAuth tokens from the URL hash and removes them from the address bar', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const session = {
      user: {
        id: 'user-id',
        email: 'player@example.com',
        user_metadata: {
          full_name: 'Player One',
          avatar_url: 'https://example.com/avatar.png',
        },
      },
    };
    setSession.mockResolvedValue({ data: { session }, error: null });
    window.location.hash =
      '#access_token=access-token&refresh_token=refresh-token&token_type=bearer';

    const service = TestBed.inject(SupabaseAuthService);
    await TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();

    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(service.profile()).toEqual({
      id: 'user-id',
      displayName: 'Joueur USERID',
      avatarKey: 'fr',
    });
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      document.title,
      window.location.href,
    );
  });

  it('syncs the public profile without exposing email in user_profiles', async () => {
    const session = {
      user: {
        id: 'user-id',
        email: 'player@example.com',
        user_metadata: {
          full_name: 'Player One',
          avatar_url: 'https://example.com/avatar.png',
        },
      },
    };
    getSession.mockResolvedValue({ data: { session }, error: null });

    TestBed.inject(SupabaseAuthService);
    await TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-id',
        display_name: 'Joueur USERID',
      }),
      { onConflict: 'user_id' },
    );
    expect(upsert.mock.calls.at(-1)?.[0]).not.toHaveProperty('email');
    expect(upsert.mock.calls.at(-1)?.[0]).not.toHaveProperty('avatar_url');
  });

  it('updates a safe custom profile through auth metadata', async () => {
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'user-id',
        email: 'player@example.com',
        user_metadata: {
          full_name: 'Player One',
        },
      },
    };
    getSession.mockResolvedValue({ data: { session }, error: null });
    updateUser.mockResolvedValue({
      data: {
        user: {
          ...session.user,
          user_metadata: {
            ...session.user.user_metadata,
            vexiio_display_name: 'Capitaine Bleu',
            vexiio_avatar_key: 'jp',
          },
        },
      },
      error: null,
    });
    const service = TestBed.inject(SupabaseAuthService);

    await TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await service.updateProfile({ displayName: '  Capitaine Bleu  ', avatarKey: 'jp' });

    expect(updateUser).toHaveBeenCalledWith({
      data: {
        vexiio_display_name: 'Capitaine Bleu',
        vexiio_avatar_key: 'jp',
      },
    });
    expect(service.profile()).toEqual({
      id: 'user-id',
      displayName: 'Capitaine Bleu',
      avatarKey: 'jp',
    });
  });
});
