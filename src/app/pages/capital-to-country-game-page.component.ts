import { Component, OnDestroy, computed, inject } from '@angular/core';
import { ClassicNameQuestionComponent } from '../components/classic-name-question.component';
import { ClassicQuizMistakesComponent } from '../components/classic-quiz-mistakes.component';
import { ClassicQuizStatusComponent } from '../components/classic-quiz-status.component';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { FlagQuizService } from '../services/flag-quiz.service';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

@Component({
  selector: 'app-capital-to-country-game-page',
  imports: [ClassicNameQuestionComponent, ClassicQuizMistakesComponent, ClassicQuizStatusComponent],
  templateUrl: './capital-to-country-game-page.component.html',
  styleUrl: './capital-to-country-game-page.component.scss',
})
export class CapitalToCountryGamePageComponent
  extends ClassicQuizPageBase<CountryNameQuizQuestion>
  implements OnDestroy
{
  private readonly flagQuizService = inject(FlagQuizService);
  private readonly capitalCountries = computed(() =>
    this.flagQuizService.filterCapitalCountries(this.countriesSignal()),
  );

  constructor() {
    super();

    this.setupClassicQuiz({
      buildQuestion: (countries, excludeCodes) =>
        this.flagQuizService.buildCapitalToCountryQuestion(countries, 'easy', excludeCodes),
      getRecordKey: () => 'capital-to-country-easy',
      getProgressGameId: () => 'classic-capital-to-country-easy',
      progressLabelKey: 'home.resume.classic',
      isReady: () => this.capitalCountries().length >= 4,
      getTotalQuestions: (countries) =>
        this.flagQuizService.filterCapitalCountries(countries).length,
    });
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }
}
