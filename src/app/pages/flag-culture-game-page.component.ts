import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { GameId } from '../data/game-catalog';
import {
  FlagCultureDifficultyMode,
  FlagCultureRoundQuestion
} from '../models/flag-culture-question';
import { CountriesService } from '../services/countries.service';
import { FlagCultureQuizService } from '../services/flag-culture-quiz.service';
import { GameProgressService } from '../services/game-progress.service';
import { I18nService } from '../services/i18n.service';
import { PersonalRecordsService } from '../services/personal-records.service';

type CultureError = {
  question: FlagCultureRoundQuestion;
  selectedAnswer: string;
};

type DifficultyModeOption = {
  value: FlagCultureDifficultyMode;
  label: string;
};

const QUESTION_COUNT = 10;

type CultureErrorSnapshot = {
  questionId: string;
  selectedAnswer: string;
};

type CultureProgressSnapshot = {
  version: 1;
  difficultyMode: FlagCultureDifficultyMode;
  questions: FlagCultureRoundQuestion[];
  questionIndex: number;
  score: number;
  answered: boolean;
  selectedAnswer: string | null;
  errors: CultureErrorSnapshot[];
};

@Component({
  selector: 'app-flag-culture-game-page',
  templateUrl: './flag-culture-game-page.component.html',
  styleUrl: './flag-culture-game-page.component.css'
})
export class FlagCultureGamePageComponent {
  private static readonly PROGRESS_GAME_ID: GameId = 'flag-culture';
  protected readonly i18n = inject(I18nService);
  private readonly countriesService = inject(CountriesService);
  private readonly cultureQuizService = inject(FlagCultureQuizService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private readonly gameProgressService = inject(GameProgressService);
  private hasInitialized = false;
  private hasSavedRecord = false;

  protected readonly countriesSignal = toSignal(this.countriesService.getCountries(), { initialValue: [] });
  protected readonly isLoading = signal(true);
  protected readonly difficultyMode = signal<FlagCultureDifficultyMode>('mixed');
  protected readonly questions = signal<FlagCultureRoundQuestion[]>([]);
  protected readonly questionIndex = signal(0);
  protected readonly score = signal(0);
  protected readonly answered = signal(false);
  protected readonly selectedAnswer = signal<string | null>(null);
  protected readonly errors = signal<CultureError[]>([]);
  protected readonly isComplete = signal(false);

  protected readonly difficultyModes = computed<DifficultyModeOption[]>(() => [
    { value: 'easy', label: this.i18n.t('common.easy') },
    { value: 'medium', label: this.i18n.t('common.medium') },
    { value: 'hard', label: this.i18n.t('common.hard') },
    { value: 'mixed', label: this.i18n.t('common.mixed') }
  ]);
  protected readonly currentQuestion = computed(
    () => this.questions()[this.questionIndex()] ?? null
  );
  protected readonly totalQuestions = computed(() => this.questions().length);
  protected readonly maxScore = computed(() => this.totalQuestions());
  protected readonly progressLabel = computed(() => {
    const total = this.totalQuestions();
    if (total === 0) {
      return '0 / 0';
    }

    return `${Math.min(this.questionIndex() + 1, total)} / ${total}`;
  });
  protected readonly progressPercent = computed(() => {
    const total = this.totalQuestions();
    if (total === 0) {
      return 0;
    }

    return Math.round(((this.questionIndex() + 1) / total) * 100);
  });
  protected readonly accuracyPercent = computed(() => {
    const total = this.maxScore();
    if (total === 0) {
      return 0;
    }

    return Math.round((this.score() / total) * 100);
  });
  protected readonly feedbackLabel = computed(() => {
    if (!this.answered()) {
      return '';
    }
    return this.selectedAnswer() === this.currentQuestion()?.correctAnswer
      ? this.i18n.t('culture.feedback.correct')
      : this.i18n.t('culture.feedback.wrong');
  });

  constructor() {
    effect(() => {
      const countries = this.countriesSignal();
      if (countries.length < 4 || this.hasInitialized) {
        return;
      }

      this.hasInitialized = true;
      if (!this.restoreProgress()) {
        this.startGame();
      }
    });

    effect(() => {
      const question = this.currentQuestion();

      if (!question || this.isComplete()) {
        if (this.isComplete()) {
          this.clearProgress();
        }
        return;
      }

      this.gameProgressService.saveProgress(
        FlagCultureGamePageComponent.PROGRESS_GAME_ID,
        this.buildProgressSnapshot(),
        {
          percent: this.progressPercent(),
          labelKey: 'home.resume.classic',
          labelParams: {
            current: this.questionIndex() + 1,
            total: this.totalQuestions()
          }
        }
      );
    });
  }

  protected selectDifficulty(mode: FlagCultureDifficultyMode): void {
    if (this.difficultyMode() === mode && this.questions().length > 0) {
      return;
    }

    this.difficultyMode.set(mode);
    this.clearProgress();
    this.startGame();
  }

  protected selectAnswer(answer: string): void {
    if (this.answered() || this.isComplete()) {
      return;
    }

    const question = this.currentQuestion();
    if (!question) {
      return;
    }

    this.selectedAnswer.set(answer);
    this.answered.set(true);

    if (answer === question.correctAnswer) {
      this.score.update((value) => value + 1);
      return;
    }

    this.errors.update((errors) => [
      ...errors,
      {
        question,
        selectedAnswer: answer
      }
    ]);
  }

  protected nextQuestion(): void {
    if (!this.answered()) {
      return;
    }

    if (this.questionIndex() >= this.totalQuestions() - 1) {
      this.finishGame();
      return;
    }

    this.questionIndex.update((index) => index + 1);
    this.answered.set(false);
    this.selectedAnswer.set(null);
  }

  protected restartGame(): void {
    this.clearProgress();
    this.startGame();
  }

  protected closeSummary(): void {
    this.isComplete.set(false);
  }

  protected getOptionState(answer: string): 'default' | 'correct' | 'wrong' {
    if (!this.answered()) {
      return 'default';
    }

    const question = this.currentQuestion();
    if (!question) {
      return 'default';
    }

    if (answer === question.correctAnswer) {
      return 'correct';
    }

    if (answer === this.selectedAnswer()) {
      return 'wrong';
    }

    return 'default';
  }

  protected getDifficultyLabel(mode: FlagCultureDifficultyMode): string {
    switch (mode) {
      case 'easy':
        return this.i18n.t('common.easy');
      case 'medium':
        return this.i18n.t('common.medium');
      case 'hard':
        return this.i18n.t('common.hard');
      default:
        return this.i18n.t('common.mixed');
    }
  }

  private startGame(): void {
    const countries = this.countriesSignal();
    if (countries.length < 4) {
      this.isLoading.set(true);
      return;
    }

    const generated = this.cultureQuizService.buildRound(this.difficultyMode(), QUESTION_COUNT);

    this.questions.set(generated);
    this.questionIndex.set(0);
    this.score.set(0);
    this.answered.set(false);
    this.selectedAnswer.set(null);
    this.errors.set([]);
    this.isComplete.set(false);
    this.isLoading.set(false);
    this.hasSavedRecord = false;
  }

  private finishGame(): void {
    if (this.isComplete()) {
      return;
    }

    this.isComplete.set(true);
    if (this.hasSavedRecord) {
      return;
    }

    this.personalRecordsService.saveResult(this.resolveRecordKey(), {
      score: this.score(),
      maxScore: Math.max(1, this.maxScore())
    });
    this.hasSavedRecord = true;
    this.clearProgress();
  }

  private resolveRecordKey():
    | 'flag-culture-easy'
    | 'flag-culture-medium'
    | 'flag-culture-hard'
    | 'flag-culture-mixed' {
    switch (this.difficultyMode()) {
      case 'easy':
        return 'flag-culture-easy';
      case 'medium':
        return 'flag-culture-medium';
      case 'hard':
        return 'flag-culture-hard';
      default:
        return 'flag-culture-mixed';
    }
  }

  private buildProgressSnapshot(): CultureProgressSnapshot {
    return {
      version: 1,
      difficultyMode: this.difficultyMode(),
      questions: this.questions(),
      questionIndex: this.questionIndex(),
      score: this.score(),
      answered: this.answered(),
      selectedAnswer: this.selectedAnswer(),
      errors: this.errors().map((error) => ({
        questionId: error.question.id,
        selectedAnswer: error.selectedAnswer
      }))
    };
  }

  private restoreProgress(): boolean {
    const snapshot = this.gameProgressService.getPayload<CultureProgressSnapshot>(
      FlagCultureGamePageComponent.PROGRESS_GAME_ID
    );
    if (!snapshot || snapshot.version !== 1 || snapshot.questions.length === 0) {
      return false;
    }

    this.difficultyMode.set(snapshot.difficultyMode);
    this.questions.set(snapshot.questions);
    this.questionIndex.set(snapshot.questionIndex);
    this.score.set(snapshot.score);
    this.answered.set(snapshot.answered);
    this.selectedAnswer.set(snapshot.selectedAnswer);
    this.errors.set(
      snapshot.errors
        .map((error) => {
          const question = snapshot.questions.find((item) => item.id === error.questionId);
          if (!question) {
            return null;
          }

          return {
            question,
            selectedAnswer: error.selectedAnswer
          };
        })
        .filter((error): error is CultureError => !!error)
    );
    this.isComplete.set(false);
    this.isLoading.set(false);
    this.hasSavedRecord = false;
    return true;
  }

  private clearProgress(): void {
    this.gameProgressService.clearProgress(FlagCultureGamePageComponent.PROGRESS_GAME_ID);
  }
}
