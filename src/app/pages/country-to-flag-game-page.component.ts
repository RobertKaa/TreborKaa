import { Component, OnDestroy, inject } from '@angular/core';
import { ClassicQuizMistakesComponent } from '../components/classic-quiz-mistakes.component';
import { ClassicQuizStatusComponent } from '../components/classic-quiz-status.component';
import { FlagQuizQuestion } from '../models/flag-quiz-question';
import { FlagQuizService } from '../services/flag-quiz.service';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

@Component({
  selector: 'app-country-to-flag-game-page',
  imports: [ClassicQuizMistakesComponent, ClassicQuizStatusComponent],
  templateUrl: './country-to-flag-game-page.component.html',
  styleUrl: './country-to-flag-game-page.component.scss',
})
export class CountryToFlagGamePageComponent
  extends ClassicQuizPageBase<FlagQuizQuestion>
  implements OnDestroy
{
  private readonly flagQuizService = inject(FlagQuizService);

  constructor() {
    super();

    this.setupClassicQuiz({
      buildQuestion: (countries, excludeCodes) =>
        this.flagQuizService.buildQuestion(countries, 'easy', excludeCodes),
      getRecordKey: () => 'country-to-flag-easy',
      getProgressGameId: () => 'classic-country-to-flag-easy',
      progressLabelKey: 'home.resume.classic',
    });
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }
}
