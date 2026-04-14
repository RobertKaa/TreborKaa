import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FlagCultureDifficultyMode,
  FlagCultureRoundQuestion
} from '../models/flag-culture-question';
import { CountriesService } from '../services/countries.service';
import { FlagCultureQuizService } from '../services/flag-culture-quiz.service';
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

@Component({
  selector: 'app-flag-culture-game-page',
  imports: [RouterLink],
  templateUrl: './flag-culture-game-page.component.html',
  styleUrl: './flag-culture-game-page.component.css'
})
export class FlagCultureGamePageComponent {
  private readonly countriesService = inject(CountriesService);
  private readonly cultureQuizService = inject(FlagCultureQuizService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
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

  protected readonly difficultyModes: DifficultyModeOption[] = [
    { value: 'easy', label: 'Facile' },
    { value: 'medium', label: 'Moyen' },
    { value: 'hard', label: 'Difficile' },
    { value: 'mixed', label: 'Mélange' }
  ];
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
      ? 'Bonne réponse'
      : 'Mauvaise réponse';
  });

  constructor() {
    effect(() => {
      const countries = this.countriesSignal();
      if (countries.length < 4 || this.hasInitialized) {
        return;
      }

      this.hasInitialized = true;
      this.startGame();
    });
  }

  protected selectDifficulty(mode: FlagCultureDifficultyMode): void {
    if (this.difficultyMode() === mode && this.questions().length > 0) {
      return;
    }

    this.difficultyMode.set(mode);
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
    this.startGame();
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
        return 'Facile';
      case 'medium':
        return 'Moyen';
      case 'hard':
        return 'Difficile';
      default:
        return 'Mélange';
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
}


