import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CountrySummary } from '../models/country-summary';
import { I18nService } from '../services/i18n.service';

type OptionState = 'default' | 'correct' | 'wrong';

@Component({
  selector: 'app-classic-name-options',
  template: `
    <div class="name-grid">
      @for (option of options; track option.code) {
        <button
          type="button"
          class="name-card"
          [class.is-correct]="optionState(option.code) === 'correct'"
          [class.is-wrong]="optionState(option.code) === 'wrong'"
          [disabled]="optionDisabled(option.code)"
          (click)="selectCode.emit(option.code)"
        >
          {{ countryName(option) }}
        </button>
      }
    </div>
  `,
  styleUrl: './classic-name-options.component.scss',
})
export class ClassicNameOptionsComponent {
  private readonly i18n = inject(I18nService);

  @Input({ required: true }) options: CountrySummary[] = [];
  @Input({ required: true }) optionState: (code: string) => OptionState = () => 'default';
  @Input({ required: true }) optionDisabled: (code: string) => boolean = () => true;

  @Output() readonly selectCode = new EventEmitter<string>();

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }
}
