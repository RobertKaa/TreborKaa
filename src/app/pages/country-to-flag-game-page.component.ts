import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CountrySummary } from '../models/country-summary';
import { FlagQuizQuestion } from '../models/flag-quiz-question';
import { CountriesService } from '../services/countries.service';
import { FlagQuizService } from '../services/flag-quiz.service';
import { PersonalRecordsService } from '../services/personal-records.service';

type GameDifficulty = 'easy' | 'hard';
type GameError = {
  promptCountry: CountrySummary;
  selectedCountry: CountrySummary | null;
  correctCountry: CountrySummary;
};

const MAX_ERRORS = 3;

@Component({
  selector: 'app-country-to-flag-game-page',
  imports: [RouterLink],
  templateUrl: './country-to-flag-game-page.component.html',
  styleUrl: './country-to-flag-game-page.component.css'
})
export class CountryToFlagGamePageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly countriesService = inject(CountriesService);
  private readonly flagQuizService = inject(FlagQuizService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private advanceTimeoutId: number | null = null;
  private hasSavedRecord = false;

  protected readonly countries$ = this.countriesService.getCountries();
  protected readonly score = signal(0);
  protected readonly questionIndex = signal(1);
  protected readonly answered = signal(false);
  protected readonly selectedCode = signal<string | null>(null);
  protected readonly wrongCodes = signal<string[]>([]);
  protected readonly wrongAttempts = signal(0);
  protected readonly usedCodes = signal<string[]>([]);
  protected readonly errors = signal<GameError[]>([]);
  protected readonly isComplete = signal(false);
  protected readonly difficulty = toSignal(
    this.route.paramMap.pipe(
      map((params) => (params.get('difficulty') === 'hard' ? 'hard' : 'easy') as GameDifficulty)
    ),
    { initialValue: 'easy' as GameDifficulty }
  );
  protected readonly countriesSignal = toSignal(this.countries$, { initialValue: [] as CountrySummary[] });
  protected readonly currentQuestion = signal<FlagQuizQuestion | null>(null);
  protected readonly totalQuestions = computed(() => this.countriesSignal().length);
  protected readonly answeredCount = computed(() => this.usedCodes().length + (this.answered() ? 1 : 0));
  protected readonly progressLabel = computed(
    () => `${Math.min(this.questionIndex(), this.totalQuestions())} / ${this.totalQuestions()}`
  );
  protected readonly progressPercent = computed(() => {
    const total = this.totalQuestions();
    return total > 0 ? Math.round((this.answeredCount() / total) * 100) : 0;
  });

  constructor() {
    effect(() => {
      const countries = this.countriesSignal();
      const difficulty = this.difficulty();

      if (countries.length < 4) {
        return;
      }

      this.score.set(0);
      this.questionIndex.set(1);
      this.answered.set(false);
      this.selectedCode.set(null);
      this.usedCodes.set([]);
      this.errors.set([]);
      this.wrongAttempts.set(0);
      this.isComplete.set(false);
      this.wrongCodes.set([]);
      this.clearPendingTransitions();
      this.hasSavedRecord = false;
      this.currentQuestion.set(this.flagQuizService.buildQuestion(countries, difficulty, []));
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
      return;
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

  ngOnDestroy(): void {
    this.clearPendingTransitions();
  }

  private generateQuestion(): void {
    const countries = this.countriesSignal();
    if (countries.length < 4) {
      return;
    }

    this.currentQuestion.set(
      this.flagQuizService.buildQuestion(countries, this.difficulty(), this.usedCodes())
    );
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
    if (this.hasSavedRecord) {
      return;
    }

    this.personalRecordsService.saveResult(
      this.difficulty() === 'hard' ? 'country-to-flag-hard' : 'country-to-flag-easy',
      {
        score: this.score(),
        maxScore: Math.max(1, this.score() + this.wrongAttempts())
      }
    );
    this.hasSavedRecord = true;
  }
}
