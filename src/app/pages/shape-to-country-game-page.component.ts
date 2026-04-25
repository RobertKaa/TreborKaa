import { Component, OnDestroy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { CountrySummary } from '../models/country-summary';
import { CountryShapesService } from '../services/country-shapes.service';
import { FlagQuizService } from '../services/flag-quiz.service';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

@Component({
  selector: 'app-shape-to-country-game-page',
  templateUrl: './shape-to-country-game-page.component.html',
  styleUrl: './shape-to-country-game-page.component.css'
})
export class ShapeToCountryGamePageComponent
  extends ClassicQuizPageBase<CountryNameQuizQuestion>
  implements OnDestroy
{
  private readonly flagQuizService = inject(FlagQuizService);
  private readonly shapesService = inject(CountryShapesService);
  private readonly shapes = toSignal(this.shapesService.getCountryShapes(), { initialValue: [] });
  private readonly shapeByCode = computed(
    () => new Map(this.shapes().map((shape) => [shape.code, shape.path]))
  );
  private readonly playableCodes = computed(() => new Set(this.shapes().map((shape) => shape.code)));
  private readonly playableCountries = computed(() => this.filterPlayableCountries(this.countriesSignal()));

  protected readonly currentShapePath = computed(() => {
    const question = this.currentQuestion();
    if (!question) {
      return null;
    }

    return this.shapeByCode().get(question.promptCountry.code) ?? null;
  });

  constructor() {
    super();

    this.setupClassicQuiz({
      buildQuestion: (countries, difficulty, excludeCodes) =>
        this.flagQuizService.buildCountryNameQuestion(
          this.filterPlayableCountries(countries),
          difficulty,
          excludeCodes
        ),
      getRecordKey: (difficulty) => (difficulty === 'hard' ? 'shape-to-country-hard' : 'shape-to-country-easy'),
      getProgressGameId: (difficulty) =>
        difficulty === 'hard' ? 'classic-shape-to-country-hard' : 'classic-shape-to-country-easy',
      progressLabelKey: 'home.resume.classic',
      isReady: () => this.playableCountries().length >= 4,
      getTotalQuestions: (countries) => this.filterPlayableCountries(countries).length
    });
  }

  protected shapePath(country: CountrySummary): string | null {
    return this.shapeByCode().get(country.code) ?? null;
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }

  private filterPlayableCountries(countries: CountrySummary[]): CountrySummary[] {
    const codes = this.playableCodes();
    return countries.filter((country) => codes.has(country.code));
  }
}
