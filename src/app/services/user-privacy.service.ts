import { Injectable, inject } from '@angular/core';
import { SupabaseAuthService } from './supabase-auth.service';

export type UserDataExport = Record<string, unknown> & {
  exported_at?: string;
  user_id?: string;
};

@Injectable({ providedIn: 'root' })
export class UserPrivacyService {
  private readonly auth = inject(SupabaseAuthService);

  readonly deleteConfirmationPhrase = 'SUPPRIMER MON COMPTE';

  async exportUserData(): Promise<UserDataExport> {
    const user = this.auth.user();
    if (!user) {
      throw new Error('privacy.error.notAuthenticated');
    }

    const client = await this.auth.getClient();
    const { data, error } = await client.rpc('export_user_data');

    if (error) {
      throw error;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('privacy.error.exportFailed');
    }

    return data as UserDataExport;
  }

  async downloadUserData(): Promise<void> {
    const payload = await this.exportUserData();
    const exportedAt =
      typeof payload.exported_at === 'string'
        ? payload.exported_at.replace(/[:.]/g, '-')
        : new Date().toISOString().replace(/[:.]/g, '-');
    const userId = typeof payload.user_id === 'string' ? payload.user_id.slice(0, 8) : 'compte';
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vexiio-export-${userId}-${exportedAt}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async deleteAccount(confirmation: string): Promise<void> {
    const user = this.auth.user();
    if (!user) {
      throw new Error('privacy.error.notAuthenticated');
    }

    if (confirmation.trim() !== this.deleteConfirmationPhrase) {
      throw new Error('privacy.error.invalidConfirmation');
    }

    const client = await this.auth.getClient();
    const { error: requestError } = await client.rpc('request_account_deletion', {
      p_confirmation: confirmation.trim(),
    });

    if (requestError) {
      throw requestError;
    }

    const { data, error } = await client.functions.invoke('account-delete', {
      body: { confirmation: confirmation.trim() },
    });

    if (error) {
      throw error;
    }

    if (!data || typeof data !== 'object' || !('deleted' in data) || data.deleted !== true) {
      throw new Error('privacy.error.deleteFailed');
    }

    await this.auth.signOut();
  }
}
