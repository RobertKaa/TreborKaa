import { Component, Input, inject } from '@angular/core';
import { CountrySummary } from '../models/country-summary';
import { I18nService } from '../services/i18n.service';
import { CountryShapeRenderData, DEFAULT_SHAPE_VIEWBOX } from '../utils/country-shape-viewbox';
import { ClassicQuizError } from '../pages/classic-quiz-page.base';

export type ClassicQuizMistakePrompt = 'country' | 'flag' | 'shape' | 'capital';

@Component({
  selector: 'app-classic-quiz-mistakes',
  template: `
    @if (errors.length === 0) {
      <p class="empty-state">{{ i18n.t('classic.emptyErrors') }}</p>
    } @else {
      @for (error of errors; track $index) {
        <article class="mistake-card">
          @switch (prompt) {
            @case ('flag') {
              <div class="mistake-flag">
                <img
                  [src]="error.promptCountry.flagUrl"
                  [alt]="i18n.t('countries.flagOf', { country: countryName(error.promptCountry) })"
                />
              </div>
            }
            @case ('shape') {
              @if (shapePath(error.promptCountry); as path) {
                <div class="mistake-shape">
                  <svg
                    [attr.viewBox]="shapeViewBox(error.promptCountry)"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden="true"
                  >
                    <path [attr.d]="path" fill-rule="evenodd" clip-rule="evenodd"></path>
                  </svg>
                </div>
              } @else {
                <p class="mistake-country">{{ countryName(error.promptCountry) }}</p>
              }
            }
            @case ('capital') {
              <p class="mistake-country">{{ capitalName(error.promptCountry) }}</p>
            }
            @default {
              <p class="mistake-country">{{ countryName(error.promptCountry) }}</p>
            }
          }

          <p class="mistake-line">
            {{ i18n.t('common.yourAnswer') }}:
            {{ error.selectedCountry ? countryName(error.selectedCountry) : i18n.t('common.none') }}
          </p>
          <p class="mistake-line">
            {{ i18n.t('common.correctAnswer') }}: {{ countryName(error.correctCountry) }}
          </p>
        </article>
      }
    }
  `,
  styleUrl: './classic-quiz-mistakes.component.scss',
})
export class ClassicQuizMistakesComponent {
  protected readonly i18n = inject(I18nService);

  @Input({ required: true }) errors: ClassicQuizError[] = [];
  @Input() prompt: ClassicQuizMistakePrompt = 'country';
  @Input() shapeByCode: ReadonlyMap<string, CountryShapeRenderData> | null = null;

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }

  protected capitalName(country: CountrySummary): string {
    return this.i18n.capitalName(country);
  }

  protected shapePath(country: CountrySummary): string | null {
    return this.shapeByCode?.get(country.code)?.path ?? null;
  }

  protected shapeViewBox(country: CountrySummary): string {
    return this.shapeByCode?.get(country.code)?.viewBox ?? DEFAULT_SHAPE_VIEWBOX;
  }
}
