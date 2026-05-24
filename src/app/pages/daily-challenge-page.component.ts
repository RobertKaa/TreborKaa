import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CountrySummary } from '../models/country-summary';
import { CountriesService } from '../services/countries.service';
import { CountryShapesService } from '../services/country-shapes.service';
import {
  DAILY_CHALLENGE_MAX_ERRORS,
  DailyChallengeMode,
  DailyChallengeQuestion,
  DailyChallengeService,
} from '../services/daily-challenge.service';
import { I18nService } from '../services/i18n.service';
import { DEFAULT_SHAPE_VIEWBOX, buildShapeViewBox } from '../utils/country-shape-viewbox';

type DailyChallengeState = 'intro' | 'running' | 'success' | 'failed';
type PromptMode = 'flag-options' | 'name-options';

const NEXT_QUESTION_DELAY_MS = 520;

@Component({
  selector: 'app-daily-challenge-page',
  imports: [RouterLink],
  templateUrl: './daily-challenge-page.component.html',
  styleUrl: './daily-challenge-page.component.scss',
})
export class DailyChallengePageComponent implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly countriesService = inject(CountriesService);
  private readonly shapesService = inject(CountryShapesService);
  private readonly dailyChallengeService = inject(DailyChallengeService);
  private nextQuestionTimeoutId: number | null = null;

  protected readonly countries = toSignal(this.countriesService.getCountries(), {
    initialValue: [] as CountrySummary[],
  });
  protected readonly shapes = toSignal(this.shapesService.getCountryShapes(), { initialValue: [] });
  protected readonly state = signal<DailyChallengeState>('intro');
  protected readonly questionIndex = signal(0);
  protected readonly selectedCode = signal<string | null>(null);
  protected readonly answered = signal(false);
  protected readonly failedQuestion = signal<DailyChallengeQuestion | null>(null);
  protected readonly correctCount = signal(0);
  protected readonly mistakeCount = signal(0);
  protected readonly rewardEarned = signal(false);
  protected readonly maxErrors = DAILY_CHALLENGE_MAX_ERRORS;
  protected readonly dailyChallenge = this.dailyChallengeService.today;
  protected readonly questions = computed(() =>
    this.dailyChallengeService.buildQuestionPlan(
      this.countries(),
      this.shapes(),
      this.dailyChallenge().dateKey,
    ),
  );
  protected readonly currentQuestion = computed(
    () => this.questions()[this.questionIndex()] ?? null,
  );
  protected readonly progressLabel = computed(
    () =>
      `${Math.min(this.questionIndex() + 1, this.dailyChallenge().questionCount)} / ${
        this.dailyChallenge().questionCount
      }`,
  );
  protected readonly answeredCount = computed(() =>
    Math.min(this.questionIndex() + (this.answered() ? 1 : 0), this.dailyChallenge().questionCount),
  );
  protected readonly progressPercent = computed(() =>
    Math.round((this.answeredCount() / this.dailyChallenge().questionCount) * 100),
  );
  protected readonly mistakeLabel = computed(() =>
    this.i18n.t('daily.errorsLeft', {
      current: this.mistakeCount(),
      max: this.maxErrors,
    }),
  );
  protected readonly isReady = computed(
    () => this.questions().length === this.dailyChallenge().questionCount,
  );
  protected readonly failedCorrectCountry = computed(
    () =>
      this.failedQuestion()?.options.find(
        (option) => option.code === this.failedQuestion()?.correctCode,
      ) ?? this.failedQuestion()?.promptCountry ?? null,
  );
  protected readonly failedSelectedCountry = computed(
    () => this.failedQuestion()?.options.find((option) => option.code === this.selectedCode()) ?? null,
  );

  protected startChallenge(): void {
    if (!this.isReady()) {
      return;
    }

    this.clearPendingTransition();
    this.state.set('running');
    this.questionIndex.set(0);
    this.selectedCode.set(null);
    this.answered.set(false);
    this.failedQuestion.set(null);
    this.correctCount.set(0);
    this.mistakeCount.set(0);
    this.rewardEarned.set(false);
  }

  protected restartChallenge(): void {
    this.startChallenge();
  }

  protected selectAnswer(code: string): void {
    const question = this.currentQuestion();
    if (!question || this.state() !== 'running' || this.answered()) {
      return;
    }

    this.selectedCode.set(code);
    this.answered.set(true);

    if (code !== question.correctCode) {
      const nextMistakeCount = this.mistakeCount() + 1;
      this.mistakeCount.set(nextMistakeCount);

      if (nextMistakeCount > this.maxErrors) {
        this.failedQuestion.set(question);
        this.state.set('failed');
        return;
      }

      this.scheduleAdvance();
      return;
    }

    this.correctCount.update((count) => count + 1);
    this.scheduleAdvance();
  }

  protected quitChallenge(): void {
    this.clearPendingTransition();
    this.state.set('intro');
    this.questionIndex.set(0);
    this.selectedCode.set(null);
    this.answered.set(false);
    this.failedQuestion.set(null);
    this.correctCount.set(0);
    this.mistakeCount.set(0);
    this.rewardEarned.set(false);
  }

  private scheduleAdvance(): void {
    this.clearPendingTransition();
    this.nextQuestionTimeoutId = window.setTimeout(() => {
      this.nextQuestionTimeoutId = null;
      this.advance();
    }, NEXT_QUESTION_DELAY_MS);
  }

  protected getOptionState(code: string): 'default' | 'correct' | 'wrong' {
    const question = this.currentQuestion() ?? this.failedQuestion();
    if (!question || !this.answered()) {
      return 'default';
    }

    if (code === question.correctCode) {
      return 'correct';
    }

    return code === this.selectedCode() ? 'wrong' : 'default';
  }

  protected isOptionDisabled(): boolean {
    return this.state() !== 'running' || this.answered();
  }

  protected getPromptMode(question: DailyChallengeQuestion): PromptMode {
    return question.mode === 'country-to-flag' ? 'flag-options' : 'name-options';
  }

  protected getModeTitle(mode: DailyChallengeMode): string {
    return this.i18n.t(`daily.mode.${mode}`);
  }

  protected getQuestionTitle(question: DailyChallengeQuestion): string {
    if (question.mode === 'capital-to-country') {
      return this.capitalName(question.promptCountry);
    }

    if (question.mode === 'flag-to-country') {
      return this.i18n.t('daily.mysteryFlag');
    }

    if (question.mode === 'shape-to-country') {
      return this.i18n.t('daily.mysteryShape');
    }

    return this.countryName(question.promptCountry);
  }

  protected shapeViewBox(question: DailyChallengeQuestion): string {
    return question.shapePath ? buildShapeViewBox(question.shapePath) : DEFAULT_SHAPE_VIEWBOX;
  }

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }

  protected capitalName(country: CountrySummary): string {
    return this.i18n.capitalName(country);
  }

  ngOnDestroy(): void {
    this.clearPendingTransition();
  }

  private advance(): void {
    if (this.questionIndex() >= this.dailyChallenge().questionCount - 1) {
      this.rewardEarned.set(
        this.dailyChallengeService.completeToday(
          this.dailyChallenge().questionCount,
          this.mistakeCount(),
        ),
      );
      this.state.set('success');
      return;
    }

    this.questionIndex.update((index) => index + 1);
    this.selectedCode.set(null);
    this.answered.set(false);
  }

  private clearPendingTransition(): void {
    if (this.nextQuestionTimeoutId !== null) {
      window.clearTimeout(this.nextQuestionTimeoutId);
      this.nextQuestionTimeoutId = null;
    }
  }
}
