import { Component, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { FlagQuizService } from '../services/flag-quiz.service';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

@Component({
  selector: 'app-flag-to-country-game-page',
  imports: [RouterLink],
  templateUrl: './flag-to-country-game-page.component.html',
  styleUrl: './flag-to-country-game-page.component.css'
})
export class FlagToCountryGamePageComponent
  extends ClassicQuizPageBase<CountryNameQuizQuestion>
  implements OnDestroy
{
  private readonly flagQuizService = inject(FlagQuizService);

  constructor() {
    super();

    this.setupClassicQuiz({
      buildQuestion: (countries, difficulty, excludeCodes) =>
        this.flagQuizService.buildCountryNameQuestion(countries, difficulty, excludeCodes),
      getRecordKey: (difficulty) => (difficulty === 'hard' ? 'flag-to-country-hard' : 'flag-to-country-easy')
    });
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }
}
