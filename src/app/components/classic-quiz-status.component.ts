import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ClassicQuizProgressComponent } from './classic-quiz-progress.component';
import { ClassicQuizSummaryComponent } from './classic-quiz-summary.component';

@Component({
  selector: 'app-classic-quiz-status',
  imports: [ClassicQuizProgressComponent, ClassicQuizSummaryComponent],
  template: `
    @if (showProgress) {
      <app-classic-quiz-progress [label]="progressLabel" [percent]="progressPercent" />
    }

    @if (showSummary) {
      <app-classic-quiz-summary
        [score]="score"
        [wrongAttempts]="wrongAttempts"
        [errorsLimit]="errorsLimit"
        (close)="close.emit()"
        (restart)="restart.emit()"
      >
        <ng-content />
      </app-classic-quiz-summary>
    }
  `,
})
export class ClassicQuizStatusComponent {
  @Input() showProgress = false;
  @Input() showSummary = false;
  @Input() progressLabel = '';
  @Input() progressPercent = 0;
  @Input() score = 0;
  @Input() wrongAttempts = 0;
  @Input() errorsLimit = 0;

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly restart = new EventEmitter<void>();
}
