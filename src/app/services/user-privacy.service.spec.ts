import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SupabaseAuthService } from './supabase-auth.service';
import { UserPrivacyService } from './user-privacy.service';

describe('UserPrivacyService', () => {
  it('exports user data through the Supabase RPC', async () => {
    const exportPayload = {
      exported_at: '2026-06-21T12:00:00.000Z',
      user_id: 'user-123',
      profile: { display_name: 'Joueur' },
    };
    const rpc = vi.fn().mockResolvedValue({ data: exportPayload, error: null });
    const client = { rpc, functions: { invoke: vi.fn() } };

    TestBed.configureTestingModule({
      providers: [
        UserPrivacyService,
        {
          provide: SupabaseAuthService,
          useValue: {
            user: signal({ id: 'user-123' }),
            getClient: vi.fn().mockResolvedValue(client),
            signOut: vi.fn(),
          },
        },
      ],
    });

    const service = TestBed.inject(UserPrivacyService);
    await expect(service.exportUserData()).resolves.toEqual(exportPayload);
    expect(rpc).toHaveBeenCalledWith('export_user_data');
  });

  it('requires the exact confirmation phrase before deleting an account', async () => {
    const requestRpc = vi.fn().mockResolvedValue({ data: '2026-06-21T12:00:00.000Z', error: null });
    const invoke = vi.fn().mockResolvedValue({ data: { deleted: true }, error: null });
    const signOut = vi.fn().mockResolvedValue(undefined);
    const client = {
      rpc: requestRpc,
      functions: { invoke },
    };

    TestBed.configureTestingModule({
      providers: [
        UserPrivacyService,
        {
          provide: SupabaseAuthService,
          useValue: {
            user: signal({ id: 'user-123' }),
            getClient: vi.fn().mockResolvedValue(client),
            signOut,
          },
        },
      ],
    });

    const service = TestBed.inject(UserPrivacyService);

    await expect(service.deleteAccount('SUPPRIMER')).rejects.toThrow(
      'privacy.error.invalidConfirmation',
    );
    expect(requestRpc).not.toHaveBeenCalled();

    await service.deleteAccount('SUPPRIMER MON COMPTE');

    expect(requestRpc).toHaveBeenCalledWith('request_account_deletion', {
      p_confirmation: 'SUPPRIMER MON COMPTE',
    });
    expect(invoke).toHaveBeenCalledWith('account-delete', {
      body: { confirmation: 'SUPPRIMER MON COMPTE' },
    });
    expect(signOut).toHaveBeenCalledOnce();
  });
});
