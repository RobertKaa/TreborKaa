import { Component, inject } from '@angular/core';
import { I18nService } from '../services/i18n.service';
import { XpFeedbackEvent, XpFeedbackService } from '../services/xp-feedback.service';

@Component({
  selector: 'app-xp-feedback-toast',
  template: `
    @if (active(); as feedback) {
      <aside
        class="xp-feedback-toast"
        role="status"
        aria-live="polite"
        [attr.aria-label]="ariaLabel(feedback)"
      >
        <div
          class="xp-feedback-badge"
          [attr.data-tier]="feedback.displayedLevelTier"
          aria-hidden="true"
        >
          <strong>{{ feedback.displayedLevel }}</strong>
        </div>

        <div class="xp-feedback-body">
          <p class="xp-feedback-kicker">{{ i18n.t('xpFeedback.kicker') }}</p>
          <div class="xp-feedback-title">
            <strong>+{{ formatNumber(feedback.amount) }} XP</strong>
            <span>
              {{
                feedback.leveledUp
                  ? i18n.t('xpFeedback.levelUp', { level: feedback.nextLevel })
                  : i18n.t(feedback.reasonKey)
              }}
            </span>
          </div>

          <div class="xp-feedback-meter-head">
            <span>{{ i18n.t('gamification.level', { level: feedback.displayedLevel }) }}</span>
            <strong>{{ formatNumber(feedback.displayedXp) }} XP</strong>
          </div>
          <div
            class="xp-feedback-meter"
            aria-hidden="true"
            [style.--xp-progress]="feedback.displayedProgressPercent + '%'"
          >
            <span></span>
          </div>
          <p class="xp-feedback-range">
            {{
              i18n.t('xpFeedback.range', {
                from: formatNumber(feedback.previousXp),
                to: formatNumber(feedback.nextXp)
              })
            }}
          </p>
        </div>

        <button
          type="button"
          class="xp-feedback-close"
          [attr.aria-label]="i18n.t('common.close')"
          (click)="dismiss()"
        >
          &times;
        </button>
      </aside>
    }
  `,
})
export class XpFeedbackToastComponent {
  protected readonly feedback = inject(XpFeedbackService);
  protected readonly i18n = inject(I18nService);
  protected readonly active = this.feedback.active;

  protected dismiss(): void {
    this.feedback.dismiss();
  }

  protected ariaLabel(feedback: XpFeedbackEvent): string {
    const levelText = feedback.leveledUp
      ? this.i18n.t('xpFeedback.ariaLevelUp', { level: feedback.nextLevel })
      : this.i18n.t(feedback.reasonKey);

    return this.i18n.t('xpFeedback.aria', {
      amount: feedback.amount,
      xp: feedback.nextXp,
      levelText,
    });
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat(this.i18n.currentLanguage() === 'fr' ? 'fr-FR' : 'en-US').format(
      value,
    );
  }
}
