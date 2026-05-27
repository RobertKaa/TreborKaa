import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-classic-quiz-summary',
  imports: [RouterLink],
  template: `
    <button
      type="button"
      class="modal-backdrop"
      [attr.aria-label]="i18n.t('common.close')"
      (click)="close.emit()"
    ></button>
    <section class="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div class="summary-head">
        <div>
          <p class="eyebrow">{{ i18n.t('common.completed') }}</p>
          <h2 id="summary-title">{{ i18n.t('common.finalResult') }}</h2>
        </div>
      </div>

      <div class="summary-score">
        <div>
          <p class="status-label">{{ i18n.t('common.correctAnswers') }}</p>
          <p class="summary-value">{{ score }}</p>
        </div>
        <div>
          <p class="status-label">{{ i18n.t('common.errors') }}</p>
          <p class="summary-value">{{ wrongAttempts }} / {{ errorsLimit }}</p>
        </div>
      </div>

      <div class="mistakes-list">
        <ng-content />
      </div>

      <div class="summary-actions">
        <button type="button" class="ghost-link ds-button is-secondary" routerLink="/">
          {{ i18n.t('common.home') }}
        </button>
        <button type="button" class="next-button ds-button is-primary" (click)="restart.emit()">
          {{ i18n.t('common.restart') }}
        </button>
      </div>
    </section>
  `,
  styleUrl: './classic-quiz-summary.component.scss',
})
export class ClassicQuizSummaryComponent {
  protected readonly i18n = inject(I18nService);

  @Input({ required: true }) score = 0;
  @Input({ required: true }) wrongAttempts = 0;
  @Input({ required: true }) errorsLimit = 0;

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly restart = new EventEmitter<void>();
}
