import { Component, OnDestroy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClassicNameQuestionComponent } from '../components/classic-name-question.component';
import { ClassicQuizMistakesComponent } from '../components/classic-quiz-mistakes.component';
import { ClassicQuizStatusComponent } from '../components/classic-quiz-status.component';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { CountrySummary } from '../models/country-summary';
import { CountryShapesService } from '../services/country-shapes.service';
import { FlagQuizService } from '../services/flag-quiz.service';
import { DEFAULT_SHAPE_VIEWBOX, buildCountryShapeLookup } from '../utils/country-shape-viewbox';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

const SHAPE_EXCLUDED_CODES = new Set([
  'ag',
  'ai',
  'aq',
  'as',
  'aw',
  'bb',
  'bl',
  'bm',
  'bs',
  'cc',
  'ck',
  'cv',
  'cw',
  'cx',
  'dm',
  'fj',
  'fk',
  'fm',
  'fo',
  'gd',
  'gf',
  'gg',
  'gi',
  'gl',
  'gp',
  'gs',
  'gu',
  'hk',
  'im',
  'io',
  'je',
  'ki',
  'km',
  'kn',
  'ky',
  'lc',
  'mh',
  'mo',
  'mp',
  'mq',
  'ms',
  'mt',
  'mu',
  'mv',
  'nc',
  'nf',
  'nr',
  'nu',
  'pf',
  'pm',
  'pn',
  'pr',
  'pw',
  're',
  'sb',
  'sc',
  'sh',
  'st',
  'sx',
  'tc',
  'tf',
  'tk',
  'to',
  'tt',
  'tv',
  'tw',
  'vc',
  'vg',
  'vi',
  'vu',
  'wf',
  'ws',
  'xk',
  'yt',
]);

const SHAPE_EXTRA_EXCLUDED_CODES = new Set([
  'ad',
  'am',
  'az',
  'ba',
  'bf',
  'bi',
  'bj',
  'bw',
  'by',
  'cf',
  'cg',
  'ci',
  'dj',
  'er',
  'gq',
  'gw',
  'kg',
  'kh',
  'la',
  'ls',
]);

@Component({
  selector: 'app-shape-to-country-game-page',
  imports: [ClassicNameQuestionComponent, ClassicQuizMistakesComponent, ClassicQuizStatusComponent],
  templateUrl: './shape-to-country-game-page.component.html',
  styleUrl: './shape-to-country-game-page.component.scss',
})
export class ShapeToCountryGamePageComponent
  extends ClassicQuizPageBase<CountryNameQuizQuestion>
  implements OnDestroy
{
  private readonly flagQuizService = inject(FlagQuizService);
  private readonly shapesService = inject(CountryShapesService);
  private readonly shapes = toSignal(this.shapesService.getCountryShapes(), { initialValue: [] });
  protected readonly shapeByCode = computed(() => buildCountryShapeLookup(this.shapes()));
  private readonly playableCodes = computed(
    () => new Set(this.shapes().map((shape) => shape.code)),
  );
  private readonly playableCountries = computed(() =>
    this.filterPlayableCountries(this.countriesSignal()),
  );

  protected readonly currentShapePath = computed(() => {
    const question = this.currentQuestion();
    if (!question) {
      return null;
    }

    return this.shapeByCode().get(question.promptCountry.code)?.path ?? null;
  });

  protected readonly currentShapeViewBox = computed(() => {
    const question = this.currentQuestion();
    if (!question) {
      return DEFAULT_SHAPE_VIEWBOX;
    }

    return this.shapeByCode().get(question.promptCountry.code)?.viewBox ?? DEFAULT_SHAPE_VIEWBOX;
  });

  constructor() {
    super();

    this.setupClassicQuiz({
      buildQuestion: (countries, excludeCodes) =>
        this.flagQuizService.buildCountryNameQuestion(
          this.filterPlayableCountries(countries),
          'easy',
          excludeCodes,
        ),
      getRecordKey: () => 'shape-to-country-easy',
      getProgressGameId: () => 'classic-shape-to-country-easy',
      progressLabelKey: 'home.resume.classic',
      isReady: () => this.playableCountries().length >= 4,
      getTotalQuestions: (countries) => this.filterPlayableCountries(countries).length,
    });
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }

  private filterPlayableCountries(countries: CountrySummary[]): CountrySummary[] {
    const codes = this.playableCodes();
    return countries.filter((country) => {
      if (!codes.has(country.code)) {
        return false;
      }

      if (SHAPE_EXCLUDED_CODES.has(country.code)) {
        return false;
      }

      if (SHAPE_EXTRA_EXCLUDED_CODES.has(country.code)) {
        return false;
      }

      return true;
    });
  }
}
