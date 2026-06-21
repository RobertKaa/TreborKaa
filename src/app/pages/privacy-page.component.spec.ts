import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { UserPrivacyService } from '../services/user-privacy.service';
import { PrivacyPageComponent } from './privacy-page.component';

describe('PrivacyPageComponent', () => {
  const downloadUserData = vi.fn();
  const deleteAccount = vi.fn();

  async function createFixture(isAuthenticated = false): Promise<{
    fixture: ComponentFixture<PrivacyPageComponent>;
    component: PrivacyPageComponent;
  }> {
    downloadUserData.mockReset().mockResolvedValue(undefined);
    deleteAccount.mockReset().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PrivacyPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { fragment: null } },
        },
        {
          provide: SupabaseAuthService,
          useValue: { isAuthenticated: () => isAuthenticated },
        },
        {
          provide: UserPrivacyService,
          useValue: {
            deleteConfirmationPhrase: 'SUPPRIMER MON COMPTE',
            downloadUserData,
            deleteAccount,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PrivacyPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    return { fixture, component };
  }

  it('prompts guests to sign in instead of showing export actions', async () => {
    const { fixture } = await createFixture(false);
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.privacy-guest-note')).toBeTruthy();
    expect(html.querySelector('.privacy-action-group button')).toBeNull();
    expect(html.querySelector('.privacy-jump-link')).toBeNull();
  });

  it('shows hero jump link and ds-button actions when authenticated', async () => {
    const { fixture } = await createFixture(true);
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.privacy-hero.ds-card')).toBeTruthy();
    expect(html.querySelector('.privacy-jump-link.ds-button.is-secondary')).toBeTruthy();
    expect(html.querySelector('.privacy-action-group:not(.is-danger) .ds-button.is-secondary')).toBeTruthy();
    expect(html.querySelector('.privacy-action-group.is-danger .ds-button.is-danger')).toBeTruthy();
  });

  it('exports account data and shows a success notice', async () => {
    const { component } = await createFixture(true);

    await (component as any).exportData();

    expect(downloadUserData).toHaveBeenCalled();
    expect((component as any).exportNotice()).toBeTruthy();
    expect((component as any).exportError()).toBeNull();
  });

  it('opens the delete dialog and requires the exact confirmation phrase', async () => {
    const { fixture, component } = await createFixture(true);

    (component as any).openDeleteDialog();
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const confirmButton = html.querySelector(
      '.privacy-dialog-actions .ds-button.is-danger',
    ) as HTMLButtonElement;

    expect(confirmButton.disabled).toBe(true);

    (component as any).deleteConfirmation.set('SUPPRIMER MON COMPTE');
    fixture.detectChanges();
    expect(confirmButton.disabled).toBe(false);

    await (component as any).confirmDeleteAccount();

    expect(deleteAccount).toHaveBeenCalledWith('SUPPRIMER MON COMPTE');
    expect((component as any).showDeleteDialog()).toBe(false);
  });
});
