import { afterNextRender, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../services/i18n.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { UserPrivacyService } from '../services/user-privacy.service';

type PrivacySection = {
  titleKey: string;
  textKey: string;
};

@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink],
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.scss',
})
export class PrivacyPageComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(SupabaseAuthService);
  private readonly privacy = inject(UserPrivacyService);
  private readonly route = inject(ActivatedRoute);

  protected readonly exportPending = signal(false);
  protected readonly exportNotice = signal<string | null>(null);
  protected readonly exportError = signal<string | null>(null);
  protected readonly deleteConfirmation = signal('');
  protected readonly deletePending = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly showDeleteDialog = signal(false);

  protected readonly sections: PrivacySection[] = [
    {
      titleKey: 'privacy.dataTitle',
      textKey: 'privacy.dataText',
    },
    {
      titleKey: 'privacy.publicTitle',
      textKey: 'privacy.publicText',
    },
    {
      titleKey: 'privacy.storageTitle',
      textKey: 'privacy.storageText',
    },
    {
      titleKey: 'privacy.rightsTitle',
      textKey: 'privacy.rightsText',
    },
  ];

  protected readonly deleteConfirmationPhrase = this.privacy.deleteConfirmationPhrase;

  constructor() {
    afterNextRender(() => this.scrollToActionsIfRequested());
  }

  protected async exportData(): Promise<void> {
    this.exportError.set(null);
    this.exportNotice.set(null);
    this.exportPending.set(true);

    try {
      await this.privacy.downloadUserData();
      this.exportNotice.set(this.i18n.t('privacy.exportSuccess'));
    } catch (error) {
      this.exportError.set(this.resolveErrorMessage(error, 'privacy.error.exportFailed'));
    } finally {
      this.exportPending.set(false);
    }
  }

  protected openDeleteDialog(): void {
    this.deleteError.set(null);
    this.deleteConfirmation.set('');
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    if (this.deletePending()) {
      return;
    }

    this.showDeleteDialog.set(false);
    this.deleteConfirmation.set('');
    this.deleteError.set(null);
  }

  protected async confirmDeleteAccount(): Promise<void> {
    this.deleteError.set(null);
    this.deletePending.set(true);

    try {
      await this.privacy.deleteAccount(this.deleteConfirmation());
      this.showDeleteDialog.set(false);
    } catch (error) {
      this.deleteError.set(this.resolveErrorMessage(error, 'privacy.error.deleteFailed'));
    } finally {
      this.deletePending.set(false);
    }
  }

  private resolveErrorMessage(error: unknown, fallbackKey: string): string {
    if (error instanceof Error && error.message.startsWith('privacy.error.')) {
      return this.i18n.t(error.message);
    }

    return this.i18n.t(fallbackKey);
  }

  private scrollToActionsIfRequested(): void {
    if (this.route.snapshot.fragment !== 'donnees-compte') {
      return;
    }

    document.getElementById('donnees-compte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
