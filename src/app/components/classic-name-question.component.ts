import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { I18nService } from '../services/i18n.service';
import { DEFAULT_SHAPE_VIEWBOX } from '../utils/country-shape-viewbox';
import { ClassicNameOptionsComponent } from './classic-name-options.component';

type OptionState = 'default' | 'correct' | 'wrong';
export type ClassicNameQuestionPrompt = 'flag' | 'shape';

@Component({
  selector: 'app-classic-name-question',
  imports: [ClassicNameOptionsComponent],
  template: `
    <main class="game-shell">
      @if (question; as currentQuestion) {
        <section class="question-card">
          <p class="question-label">{{ i18n.t(labelKey) }}</p>

          @if (prompt === 'flag') {
            <div class="prompt-flag">
              <img
                [src]="currentQuestion.promptCountry.flagUrl"
                [alt]="
                  i18n.t('countries.flagOf', {
                    country: countryName(currentQuestion.promptCountry),
                  })
                "
              />
            </div>
          } @else {
            <div class="prompt-shape">
              @if (shapePath) {
                <svg
                  [attr.viewBox]="shapeViewBox"
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  [attr.aria-label]="i18n.t('classic.shapeAria')"
                >
                  <path [attr.d]="shapePath" fill-rule="evenodd" clip-rule="evenodd"></path>
                </svg>
              } @else {
                <p class="question-help">{{ i18n.t('common.loadingGame') }}</p>
              }
            </div>
          }

          <p class="question-help">
            {{ i18n.t('classic.capital', { capital: capitalName(currentQuestion) }) }}
          </p>

          <app-classic-name-options
            [options]="currentQuestion.options"
            [optionState]="optionState"
            [optionDisabled]="optionDisabled"
            (selectCode)="selectCode.emit($event)"
          />
        </section>
      } @else {
        <section class="question-card">
          <p class="question-help">{{ i18n.t('common.loadingGame') }}</p>
        </section>
      }
    </main>
  `,
  styleUrl: './classic-name-question.component.scss',
})
export class ClassicNameQuestionComponent {
  protected readonly i18n = inject(I18nService);

  @Input({ required: true }) question: CountryNameQuizQuestion | null = null;
  @Input({ required: true }) labelKey = '';
  @Input({ required: true }) prompt: ClassicNameQuestionPrompt = 'flag';
  @Input() shapePath: string | null = null;
  @Input() shapeViewBox = DEFAULT_SHAPE_VIEWBOX;
  @Input({ required: true }) optionState: (code: string) => OptionState = () => 'default';
  @Input({ required: true }) optionDisabled: (code: string) => boolean = () => true;

  @Output() readonly selectCode = new EventEmitter<string>();

  protected countryName(country: CountryNameQuizQuestion['promptCountry']): string {
    return this.i18n.countryName(country);
  }

  protected capitalName(question: CountryNameQuizQuestion): string {
    return this.i18n.capitalName(question.promptCountry);
  }
}
