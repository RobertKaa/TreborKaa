import { computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { GameId } from '../data/game-catalog';
import { CountrySummary } from '../models/country-summary';
import { GameRecordKey } from '../models/personal-record';
import { CountriesService } from '../services/countries.service';
import { GameProgressService } from '../services/game-progress.service';
import { I18nService } from '../services/i18n.service';
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
  getProgressGameId: (difficulty: GameDifficulty) => GameId;
  progressLabelKey: string;
  isReady?: () => boolean;
  getTotalQuestions?: (countries: CountrySummary[], difficulty: GameDifficulty) => number;
};

const MAX_ERRORS = 3;

type ClassicQuizErrorSnapshot = {
  promptCode: string;
  selectedCode: string | null;
  correctCode: string;
};

type ClassicQuestionSnapshot = {
  promptCode: string;
  optionCodes: string[];
  correctCode: string;
};

type ClassicQuizProgressSnapshot = {
  version: 1;
  difficulty: GameDifficulty;
  score: number;
  questionIndex: number;
  answered: boolean;
  selectedCode: string | null;
  wrongCodes: string[];
  wrongAttempts: number;
  usedCodes: string[];
  isComplete: boolean;
  errors: ClassicQuizErrorSnapshot[];
  currentQuestion: ClassicQuestionSnapshot | null;
};

export abstract class ClassicQuizPageBase<TQuestion extends BaseQuestion> {
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);
  private readonly countriesService = inject(CountriesService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private readonly gameProgressService = inject(GameProgressService);
  private buildQuestionFn: QuizSetup<TQuestion>['buildQuestion'] | null = null;
  private getRecordKeyFn: QuizSetup<TQuestion>['getRecordKey'] | null = null;
  private getProgressGameIdFn: QuizSetup<TQuestion>['getProgressGameId'] | null = null;
  private isReadyFn: QuizSetup<TQuestion>['isReady'] | null = null;
  private getTotalQuestionsFn: QuizSetup<TQuestion>['getTotalQuestions'] | null = null;
  private progressLabelKey = 'home.resume.classic';
  private advanceTimeoutId: number | null = null;
  private hasSavedRecord = false;
  private hasBoundEffect = false;
  private hasBoundProgressEffect = false;

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
  protected readonly totalQuestions = computed(() => {
    const countries = this.countriesSignal();
    const difficulty = this.difficulty();
    if (this.getTotalQuestionsFn) {
      return Math.max(0, this.getTotalQuestionsFn(countries, difficulty));
    }

    return countries.length;
  });
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
    this.getProgressGameIdFn = setup.getProgressGameId;
    this.progressLabelKey = setup.progressLabelKey;
    this.isReadyFn = setup.isReady ?? null;
    this.getTotalQuestionsFn = setup.getTotalQuestions ?? null;

    if (this.hasBoundEffect) {
      return;
    }

    this.hasBoundEffect = true;
    effect(() => {
      const countries = this.countriesSignal();
      const difficulty = this.difficulty();
      const isReady = this.isReadyFn?.() ?? true;
      const totalQuestions = this.totalQuestions();

      if (totalQuestions < 4 || !this.buildQuestionFn || !isReady) {
        return;
      }

      const restored = untracked(() => this.restoreProgressState(countries, difficulty));
      if (!restored) {
        this.resetGameState();
        this.currentQuestion.set(this.buildQuestionFn(countries, difficulty, []));
      }
    });

    this.bindProgressEffect();
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
      this.errors.update((errors) => [
        ...errors,
        {
          promptCountry: question.promptCountry,
          selectedCountry,
          correctCountry
        }
      ]);
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
    this.clearProgressState();
    this.generateQuestion();
  }

  protected closeSummary(): void {
    this.restartGame();
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

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }

  protected capitalName(country: CountrySummary): string {
    return this.i18n.capitalName(country);
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
    const isReady = this.isReadyFn?.() ?? true;
    const totalQuestions = this.totalQuestions();
    if (totalQuestions < 4 || !this.buildQuestionFn || !isReady) {
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
    this.clearProgressState();
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

  private bindProgressEffect(): void {
    if (this.hasBoundProgressEffect) {
      return;
    }

    this.hasBoundProgressEffect = true;
    effect(() => {
      const countries = this.countriesSignal();
      const difficulty = this.difficulty();
      const question = this.currentQuestion();
      const progressGameId = this.getProgressGameIdFn?.(difficulty) ?? null;
      const isReady = this.isReadyFn?.() ?? true;
      const totalQuestions = this.totalQuestions();

      if (!progressGameId || totalQuestions < 4 || !question || this.isComplete() || !isReady) {
        if (progressGameId && this.isComplete()) {
          this.gameProgressService.clearProgress(progressGameId);
        }
        return;
      }

      const snapshot = this.buildProgressSnapshot(difficulty, question);
      this.gameProgressService.saveProgress(progressGameId, snapshot, {
        percent: this.progressPercent(),
        labelKey: this.progressLabelKey,
        labelParams: {
          current: Math.min(this.questionIndex(), this.totalQuestions()),
          total: this.totalQuestions()
        }
      });
    });
  }

  private buildProgressSnapshot(
    difficulty: GameDifficulty,
    question: TQuestion
  ): ClassicQuizProgressSnapshot {
    return {
      version: 1,
      difficulty,
      score: this.score(),
      questionIndex: this.questionIndex(),
      answered: this.answered(),
      selectedCode: this.selectedCode(),
      wrongCodes: [...this.wrongCodes()],
      wrongAttempts: this.wrongAttempts(),
      usedCodes: [...this.usedCodes()],
      isComplete: this.isComplete(),
      errors: this.errors().map((error) => ({
        promptCode: error.promptCountry.code,
        selectedCode: error.selectedCountry?.code ?? null,
        correctCode: error.correctCountry.code
      })),
      currentQuestion: {
        promptCode: question.promptCountry.code,
        optionCodes: question.options.map((option) => option.code),
        correctCode: question.correctCode
      }
    };
  }

  private restoreProgressState(countries: CountrySummary[], difficulty: GameDifficulty): boolean {
    const gameId = this.getProgressGameIdFn?.(difficulty);
    if (!gameId) {
      return false;
    }

    const snapshot = this.gameProgressService.getPayload<ClassicQuizProgressSnapshot>(gameId);
    if (!snapshot || snapshot.version !== 1 || snapshot.difficulty !== difficulty || snapshot.isComplete) {
      return false;
    }

    const byCode = new Map(countries.map((country) => [country.code, country]));
    const question = this.hydrateQuestion(snapshot.currentQuestion, byCode);
    if (!question) {
      return false;
    }

    this.score.set(snapshot.score);
    this.questionIndex.set(snapshot.questionIndex);
    this.answered.set(false);
    this.selectedCode.set(null);
    this.wrongCodes.set(snapshot.wrongCodes);
    this.wrongAttempts.set(snapshot.wrongAttempts);
    this.usedCodes.set(snapshot.usedCodes);
    this.isComplete.set(false);
    this.errors.set(
      snapshot.errors
        .map((error) => {
          const promptCountry = byCode.get(error.promptCode) ?? null;
          const selectedCountry = error.selectedCode ? byCode.get(error.selectedCode) ?? null : null;
          const correctCountry = byCode.get(error.correctCode) ?? null;
          if (!promptCountry || !correctCountry) {
            return null;
          }

          return {
            promptCountry,
            selectedCountry,
            correctCountry
          };
        })
        .filter((item): item is ClassicQuizError => !!item)
    );
    this.currentQuestion.set(question);
    this.hasSavedRecord = false;
    return true;
  }

  private hydrateQuestion(
    snapshot: ClassicQuestionSnapshot | null,
    byCode: Map<string, CountrySummary>
  ): TQuestion | null {
    if (!snapshot) {
      return null;
    }

    const promptCountry = byCode.get(snapshot.promptCode);
    if (!promptCountry) {
      return null;
    }

    const options = snapshot.optionCodes
      .map((code) => byCode.get(code) ?? null)
      .filter((country): country is CountrySummary => !!country);
    if (options.length < 2) {
      return null;
    }

    const baseQuestion: BaseQuestion = {
      promptCountry,
      options,
      correctCode: snapshot.correctCode
    };

    return baseQuestion as TQuestion;
  }

  private clearProgressState(): void {
    const gameId = this.getProgressGameIdFn?.(this.difficulty());
    if (!gameId) {
      return;
    }

    this.gameProgressService.clearProgress(gameId);
  }
}
