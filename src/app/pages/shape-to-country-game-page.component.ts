import { Component, OnDestroy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CountryNameQuizQuestion } from '../models/country-name-quiz-question';
import { CountrySummary } from '../models/country-summary';
import { CountryShapesService } from '../services/country-shapes.service';
import { FlagQuizService } from '../services/flag-quiz.service';
import { ClassicQuizPageBase } from './classic-quiz-page.base';

const DEFAULT_SHAPE_VIEWBOX = '0 0 1000 1000';

const HARD_EXCLUDED_CODES = new Set([
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
  'yt'
]);

const EASY_EXTRA_EXCLUDED_CODES = new Set([
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
  'ls'
]);

@Component({
  selector: 'app-shape-to-country-game-page',
  imports: [RouterLink],
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
    () =>
      new Map(
        this.shapes().map((shape) => [
          shape.code,
          {
            path: shape.path,
            viewBox: buildShapeViewBox(shape.path)
          }
        ])
      )
  );
  private readonly playableCodes = computed(() => new Set(this.shapes().map((shape) => shape.code)));
  private readonly playableCountries = computed(() =>
    this.filterPlayableCountries(this.countriesSignal(), this.difficulty())
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
      buildQuestion: (countries, difficulty, excludeCodes) =>
        this.flagQuizService.buildCountryNameQuestion(
          this.filterPlayableCountries(countries, difficulty),
          difficulty,
          excludeCodes
        ),
      getRecordKey: (difficulty) => (difficulty === 'hard' ? 'shape-to-country-hard' : 'shape-to-country-easy'),
      getProgressGameId: (difficulty) =>
        difficulty === 'hard' ? 'classic-shape-to-country-hard' : 'classic-shape-to-country-easy',
      progressLabelKey: 'home.resume.classic',
      isReady: () => this.playableCountries().length >= 4,
      getTotalQuestions: (countries, difficulty) => this.filterPlayableCountries(countries, difficulty).length
    });
  }

  protected shapePath(country: CountrySummary): string | null {
    return this.shapeByCode().get(country.code)?.path ?? null;
  }

  protected shapeViewBox(country: CountrySummary): string {
    return this.shapeByCode().get(country.code)?.viewBox ?? DEFAULT_SHAPE_VIEWBOX;
  }

  ngOnDestroy(): void {
    this.clearQuizTimers();
  }

  private filterPlayableCountries(
    countries: CountrySummary[],
    difficulty: 'easy' | 'hard'
  ): CountrySummary[] {
    const codes = this.playableCodes();
    return countries.filter((country) => {
      if (!codes.has(country.code)) {
        return false;
      }

      if (HARD_EXCLUDED_CODES.has(country.code)) {
        return false;
      }

      if (difficulty === 'easy' && EASY_EXTRA_EXCLUDED_CODES.has(country.code)) {
        return false;
      }

      return true;
    });
  }
}

function buildShapeViewBox(path: string): string {
  const points = extractPathPoints(path);
  if (points.length === 0) {
    return DEFAULT_SHAPE_VIEWBOX;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return DEFAULT_SHAPE_VIEWBOX;
  }

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const padding = clamp(Math.max(width, height) * 0.06, 10, 34);

  const originX = roundViewboxNumber(minX - padding);
  const originY = roundViewboxNumber(minY - padding);
  const viewWidth = roundViewboxNumber(width + padding * 2);
  const viewHeight = roundViewboxNumber(height + padding * 2);

  return `${originX} ${originY} ${viewWidth} ${viewHeight}`;
}

function extractPathPoints(path: string): Array<[number, number]> {
  const values = path.match(/-?\d*\.?\d+/g);
  if (!values || values.length < 2) {
    return [];
  }

  const points: Array<[number, number]> = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = Number(values[index]);
    const y = Number(values[index + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }

    points.push([x, y]);
  }

  return points;
}

function roundViewboxNumber(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
