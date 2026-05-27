import { Component, OnDestroy, inject } from '@angular/core';
import { ClassicNameQuestionComponent } from '../components/classic-name-question.component';
import { ClassicQuizMistakesComponent } from '../components/classic-quiz-mistakes.component';
import { ClassicQuizStatusComponent } from '../components/classic-quiz-status.component';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { FlagQuizService } from '../services/flag-quiz.service';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

@Component({
  selector: 'app-flag-to-country-game-page',
  imports: [ClassicNameQuestionComponent, ClassicQuizMistakesComponent, ClassicQuizStatusComponent],
  templateUrl: './flag-to-country-game-page.component.html',
  styleUrl: './flag-to-country-game-page.component.scss',
})
export class FlagToCountryGamePageComponent
  extends ClassicQuizPageBase<CountryNameQuizQuestion>
  implements OnDestroy
{
  private readonly flagQuizService = inject(FlagQuizService);

  constructor() {
    super();

    this.setupClassicQuiz({
      buildQuestion: (countries, excludeCodes) =>
        this.flagQuizService.buildCountryNameQuestion(countries, 'easy', excludeCodes),
      getRecordKey: () => 'flag-to-country-easy',
      getProgressGameId: () => 'classic-flag-to-country-easy',
      progressLabelKey: 'home.resume.classic',
    });
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }
}
