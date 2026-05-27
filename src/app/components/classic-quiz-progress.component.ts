import { Component, Input } from '@angular/core';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-classic-quiz-progress',
  template: `
    <section class="quiz-progress-strip" [attr.aria-label]="i18n.t('classic.stateAria')">
      <span class="quiz-progress-kicker">{{ i18n.t('common.progress') }}</span>
      <p class="quiz-progress-value">{{ label }}</p>
      <div class="quiz-progress-track" aria-hidden="true">
        <div class="quiz-progress-fill" [style.width.%]="percent"></div>
      </div>
    </section>
  `,
  styleUrl: './classic-quiz-progress.component.scss',
})
export class ClassicQuizProgressComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) percent = 0;

  constructor(protected readonly i18n: I18nService) {}
}
