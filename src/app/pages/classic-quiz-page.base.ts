import { computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { CountrySummary } from '../models/country-summary';
import { GameRecordKey } from '../models/personal-record';
import { CountriesService } from '../services/countries.service';
import { PersonalRecordsService } from '../services/personal-records.service';

type GameDifficulty = 'easy' | 'hard';
type BaseQuestion = {
  promptCountry: CountrySummary;
  options: CountrySummary[];
  correctCode: string;
};

export type ClassicQuizError = {
  promptCountry: CountrySummary;
  selectedCountry: CountrySummary | null;
  correctCountry: CountrySummary;
};

type QuizSetup<TQuestion extends BaseQuestion> = {
  buildQuestion: (countries: CountrySummary[], difficulty: GameDifficulty, excludeCodes: string[]) => TQuestion;
  getRecordKey: (difficulty: GameDifficulty) => GameRecordKey;
};

const MAX_ERRORS = 3;

export abstract class ClassicQuizPageBase<TQuestion extends BaseQuestion> {
  private readonly route = inject(ActivatedRoute);
  private readonly countriesService = inject(CountriesService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private buildQuestionFn: QuizSetup<TQuestion>['buildQuestion'] | null = null;
  private getRecordKeyFn: QuizSetup<TQuestion>['getRecordKey'] | null = null;
  private advanceTimeoutId: number | null = null;
  private hasSavedRecord = false;
  private hasBoundEffect = false;

  protected readonly score = signal(0);
  protected readonly questionIndex = signal(1);
  protected readonly answered = signal(false);
  protected readonly selectedCode = signal<string | null>(null);
  protected readonly wrongCodes = signal<string[]>([]);
  protected readonly wrongAttempts = signal(0);
  protected readonly usedCodes = signal<string[]>([]);
  protected readonly errors = signal<ClassicQuizError[]>([]);
  protected readonly isComplete = signal(false);
  protected readonly difficulty = toSignal(
    this.route.paramMap.pipe(
      map((params) => (params.get('difficulty') === 'hard' ? 'hard' : 'easy') as GameDifficulty)
    ),
    { initialValue: 'easy' as GameDifficulty }
  );
  protected readonly countries$ = this.countriesService.getCountries();
  protected readonly countriesSignal = toSignal(this.countries$, { initialValue: [] as CountrySummary[] });
  protected readonly currentQuestion = signal<TQuestion | null>(null);
  protected readonly totalQuestions = computed(() => this.countriesSignal().length);
  protected readonly answeredCount = computed(() => this.usedCodes().length + (this.answered() ? 1 : 0));
  protected readonly progressLabel = computed(
    () => `${Math.min(this.questionIndex(), this.totalQuestions())} / ${this.totalQuestions()}`
  );
  protected readonly progressPercent = computed(() => {
    const total = this.totalQuestions();
    return total > 0 ? Math.round((this.answeredCount() / total) * 100) : 0;
  });

  protected constructor() {}

  protected setupClassicQuiz(setup: QuizSetup<TQuestion>): void {
    this.buildQuestionFn = setup.buildQuestion;
    this.getRecordKeyFn = setup.getRecordKey;

    if (this.hasBoundEffect) {
      return;
    }

    this.hasBoundEffect = true;
    effect(() => {
      const countries = this.countriesSignal();
      const difficulty = this.difficulty();

      if (countries.length < 4 || !this.buildQuestionFn) {
        return;
      }

      this.resetGameState();
      this.currentQuestion.set(this.buildQuestionFn(countries, difficulty, []));
    });
  }

  protected selectAnswer(code: string): void {
    if (this.answered() || !this.currentQuestion() || this.isOptionDisabled(code)) {
      return;
    }

    const question = this.currentQuestion();
    this.selectedCode.set(code);

    if (code === question?.correctCode) {
      this.answered.set(true);
      this.score.update((score) => score + 1);
      this.scheduleAdvance();
      return;
    }

    const selectedCountry = question?.options.find((option) => option.code === code) ?? null;
    const correctCountry =
      question?.options.find((option) => option.code === question.correctCode) ?? question?.promptCountry;

    this.wrongAttempts.update((value) => value + 1);
    this.wrongCodes.update((codes) => (codes.includes(code) ? codes : [...codes, code]));

    if (question && correctCountry) {
      const alreadyTracked = this.errors().some(
        (error) => error.promptCountry.code === question.promptCountry.code
      );

      if (!alreadyTracked) {
        this.errors.update((errors) => [
          ...errors,
          {
            promptCountry: question.promptCountry,
            selectedCountry,
            correctCountry
          }
        ]);
      }
    }

    if (this.wrongAttempts() >= MAX_ERRORS) {
      this.answered.set(true);
      this.scheduleGameOver();
    }
  }

  protected getErrorsLimit(): number {
    return MAX_ERRORS;
  }

  protected nextQuestion(): void {
    this.clearPendingTransitions();
    const current = this.currentQuestion();
    if (current) {
      this.usedCodes.update((codes) => [...codes, current.correctCode]);
    }

    if (this.usedCodes().length >= this.totalQuestions()) {
      this.finishGame();
      return;
    }

    this.questionIndex.update((value) => value + 1);
    this.answered.set(false);
    this.selectedCode.set(null);
    this.wrongCodes.set([]);
    this.generateQuestion();
  }

  protected restartGame(): void {
    this.resetGameState();
    this.generateQuestion();
  }

  protected getOptionState(code: string): 'default' | 'correct' | 'wrong' {
    if (!this.currentQuestion()) {
      return 'default';
    }

    if (code === this.currentQuestion()!.correctCode && this.answered()) {
      return 'correct';
    }

    if (this.wrongCodes().includes(code)) {
      return 'wrong';
    }

    return 'default';
  }

  protected isOptionDisabled(code: string): boolean {
    if (this.isComplete() || this.answered()) {
      return true;
    }

    return this.wrongCodes().includes(code);
  }

  protected clearQuizTimers(): void {
    this.clearPendingTransitions();
  }

  private resetGameState(): void {
    this.score.set(0);
    this.questionIndex.set(1);
    this.answered.set(false);
    this.selectedCode.set(null);
    this.wrongCodes.set([]);
    this.usedCodes.set([]);
    this.errors.set([]);
    this.wrongAttempts.set(0);
    this.isComplete.set(false);
    this.clearPendingTransitions();
    this.hasSavedRecord = false;
  }

  private generateQuestion(): void {
    const countries = this.countriesSignal();
    if (countries.length < 4 || !this.buildQuestionFn) {
      return;
    }

    this.currentQuestion.set(this.buildQuestionFn(countries, this.difficulty(), this.usedCodes()));
  }

  private scheduleAdvance(): void {
    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId);
    }

    this.advanceTimeoutId = window.setTimeout(() => {
      this.nextQuestion();
      this.advanceTimeoutId = null;
    }, 700);
  }

  private scheduleGameOver(): void {
    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId);
    }

    this.advanceTimeoutId = window.setTimeout(() => {
      this.finishGame();
      this.advanceTimeoutId = null;
    }, 700);
  }

  private clearPendingTransitions(): void {
    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId);
      this.advanceTimeoutId = null;
    }
  }

  private finishGame(): void {
    this.isComplete.set(true);
    this.persistRecordIfNeeded();
  }

  private persistRecordIfNeeded(): void {
    if (this.hasSavedRecord || !this.getRecordKeyFn) {
      return;
    }

    this.personalRecordsService.saveResult(this.getRecordKeyFn(this.difficulty()), {
      score: this.score(),
      maxScore: Math.max(1, this.score() + this.wrongAttempts())
    });
    this.hasSavedRecord = true;
  }
}
