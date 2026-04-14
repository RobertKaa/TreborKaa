import { Component, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlagQuizQuestion } from '../models/flag-quiz-question';
import { FlagQuizService } from '../services/flag-quiz.service';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

@Component({
  selector: 'app-country-to-flag-game-page',
  imports: [RouterLink],
  templateUrl: './country-to-flag-game-page.component.html',
  styleUrl: './country-to-flag-game-page.component.css'
})
export class CountryToFlagGamePageComponent
  extends ClassicQuizPageBase<FlagQuizQuestion>
  implements OnDestroy
{
  private readonly flagQuizService = inject(FlagQuizService);

  constructor() {
    super();

    this.setupClassicQuiz({
      buildQuestion: (countries, difficulty, excludeCodes) =>
        this.flagQuizService.buildQuestion(countries, difficulty, excludeCodes),
      getRecordKey: (difficulty) => (difficulty === 'hard' ? 'country-to-flag-hard' : 'country-to-flag-easy')
    });
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }
}
