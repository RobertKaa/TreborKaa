import { toSignal } from '@angular/core/rxjs-interop';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameId } from '../data/game-catalog';
import { CountrySummary } from '../models/country-summary';
import { CountriesService } from '../services/countries.service';
import { FlagQuizService } from '../services/flag-quiz.service';
import { GameProgressService } from '../services/game-progress.service';
import { I18nService } from '../services/i18n.service';
import { PersonalRecordsService } from '../services/personal-records.service';

type GameDifficulty = 'easy' | 'hard';
type ChronoQuestionMode = 'country-to-flag' | 'flag-to-country' | 'capital-to-flag';

type ChronoQuestion = {
  mode: ChronoQuestionMode;
  difficulty: GameDifficulty;
  promptCountry: CountrySummary;
  options: CountrySummary[];
  correctCode: string;
};

type ChronoError = {
  question: ChronoQuestion;
  selectedCountry: CountrySummary | null;
  correctCountry: CountrySummary;
};

type FeedbackState = {
  kind: 'correct' | 'wrong';
  message: string;
};

type ChronoQuestionSnapshot = {
  mode: ChronoQuestionMode;
  difficulty: GameDifficulty;
  promptCode: string;
  optionCodes: string[];
  correctCode: string;
};

type ChronoErrorSnapshot = {
  question: ChronoQuestionSnapshot;
  selectedCode: string | null;
  correctCode: string;
};

type ChronoProgressSnapshot = {
  version: 1;
  score: number;
  streak: number;
  bestStreak: number;
  questionNumber: number;
  correctCount: number;
  wrongCount: number;
  answered: boolean;
  selectedCode: string | null;
  timeLeft: number;
  askedCodes: string[];
  lastMode: ChronoQuestionMode | null;
  currentQuestion: ChronoQuestionSnapshot | null;
  errors: ChronoErrorSnapshot[];
};

const GAME_DURATION_SECONDS = 75;
const MAX_DURATION_SECONDS = 105;
const TIMER_REFRESH_MS = 200;
const QUESTION_SWITCH_DELAY_MS = 520;
const WRONG_PENALTY_SECONDS = 4;
const COMBO_TIME_BONUS_EVERY = 5;
const COMBO_TIME_BONUS_SECONDS = 2;
const VISIBLE_ERRORS_LIMIT = 8;

@Component({
  selector: 'app-chrono-flags-game-page',
  imports: [RouterLink],
  templateUrl: './chrono-flags-game-page.component.html',
  styleUrl: './chrono-flags-game-page.component.css'
})
export class ChronoFlagsGamePageComponent implements OnDestroy {
  private static readonly PROGRESS_GAME_ID: GameId = 'flag-chrono';
  protected readonly i18n = inject(I18nService);
  private readonly countriesService = inject(CountriesService);
  private readonly flagQuizService = inject(FlagQuizService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private readonly gameProgressService = inject(GameProgressService);

  private timerIntervalId: number | null = null;
  private advanceTimeoutId: number | null = null;
  private feedbackTimeoutId: number | null = null;
  private timerDeadlineMs: number | null = null;
  private hasInitialized = false;
  private hasSavedRecord = false;

  protected readonly countriesSignal = toSignal(this.countriesService.getCountries(), {
    initialValue: [] as CountrySummary[]
  });
  protected readonly currentQuestion = signal<ChronoQuestion | null>(null);
  protected readonly score = signal(0);
  protected readonly streak = signal(0);
  protected readonly bestStreak = signal(0);
  protected readonly questionNumber = signal(0);
  protected readonly correctCount = signal(0);
  protected readonly wrongCount = signal(0);
  protected readonly answered = signal(false);
  protected readonly selectedCode = signal<string | null>(null);
  protected readonly timeLeft = signal(GAME_DURATION_SECONDS);
  protected readonly isComplete = signal(false);
  protected readonly errors = signal<ChronoError[]>([]);
  protected readonly feedback = signal<FeedbackState | null>(null);
  protected readonly askedCodes = signal<string[]>([]);
  protected readonly lastMode = signal<ChronoQuestionMode | null>(null);

  protected readonly isReady = computed(() => this.countriesSignal().length >= 4);
  protected readonly totalAnswers = computed(() => this.correctCount() + this.wrongCount());
  protected readonly accuracy = computed(() => {
    const total = this.totalAnswers();
    if (total === 0) {
      return 0;
    }

    return Math.round((this.correctCount() / total) * 100);
  });
  protected readonly visibleErrors = computed(() => this.errors().slice(0, VISIBLE_ERRORS_LIMIT));
  protected readonly timerLabel = computed(() => this.formatTimer(this.timeLeft()));
  protected readonly timerPercent = computed(() =>
    Math.max(0, Math.min(100, Math.round((this.timeLeft() / GAME_DURATION_SECONDS) * 100)))
  );

  constructor() {
    effect(() => {
      const countries = this.countriesSignal();
      if (countries.length < 4 || this.hasInitialized) {
        return;
      }

      this.hasInitialized = true;
      if (!this.restoreProgress(countries)) {
        this.startGame();
      }
    });

    effect(() => {
      const countries = this.countriesSignal();
      const question = this.currentQuestion();
      const remainingTime = this.timeLeft();

      if (countries.length < 4 || !question || this.isComplete() || remainingTime <= 0) {
        if (this.isComplete() || remainingTime <= 0) {
          this.clearProgress();
        }
        return;
      }

      this.gameProgressService.saveProgress(
        ChronoFlagsGamePageComponent.PROGRESS_GAME_ID,
        this.buildProgressSnapshot(),
        {
          percent: Math.max(
            0,
            Math.min(99, Math.round(((GAME_DURATION_SECONDS - this.timeLeft()) / GAME_DURATION_SECONDS) * 100))
          ),
          labelKey: 'home.resume.chrono',
          labelParams: {
            questions: this.questionNumber(),
            time: this.timerLabel()
          }
        }
      );
    });
  }

  protected selectAnswer(code: string): void {
    const question = this.currentQuestion();
    if (!question || this.answered() || this.isComplete()) {
      return;
    }

    this.selectedCode.set(code);
    this.answered.set(true);

    const selectedCountry = question.options.find((country) => country.code === code) ?? null;
    const correctCountry =
      question.options.find((country) => country.code === question.correctCode) ?? question.promptCountry;

    if (code === question.correctCode) {
      const nextStreak = this.streak() + 1;
      this.streak.set(nextStreak);
      this.bestStreak.update((best) => Math.max(best, nextStreak));
      this.correctCount.update((value) => value + 1);

      const gainedScore = this.computePoints(question.difficulty, nextStreak);
      this.score.update((value) => value + gainedScore);

      if (nextStreak % COMBO_TIME_BONUS_EVERY === 0) {
        this.addTime(COMBO_TIME_BONUS_SECONDS);
        this.showFeedback(
          'correct',
          this.i18n.t('classic.chrono.feedback.correctBonus', {
            points: gainedScore,
            seconds: COMBO_TIME_BONUS_SECONDS
          })
        );
      } else {
        this.showFeedback(
          'correct',
          this.i18n.t('classic.chrono.feedback.correct', { points: gainedScore })
        );
      }
    } else {
      this.streak.set(0);
      this.wrongCount.update((value) => value + 1);
      this.errors.update((errors) => [
        ...errors,
        {
          question,
          selectedCountry,
          correctCountry
        }
      ]);
      this.subtractTime(WRONG_PENALTY_SECONDS);
      this.showFeedback(
        'wrong',
        this.i18n.t('classic.chrono.feedback.wrong', {
          seconds: WRONG_PENALTY_SECONDS,
          country: this.countryName(correctCountry)
        })
      );
    }

    if (!this.isComplete()) {
      this.scheduleNextQuestion();
    }
  }

  protected restartGame(): void {
    if (!this.isReady()) {
      return;
    }

    this.startGame();
  }

  protected closeSummary(): void {
    this.restartGame();
  }

  protected getOptionState(code: string): 'default' | 'correct' | 'wrong' {
    const question = this.currentQuestion();
    if (!question || !this.answered()) {
      return 'default';
    }

    if (code === question.correctCode) {
      return 'correct';
    }

    if (code === this.selectedCode()) {
      return 'wrong';
    }

    return 'default';
  }

  protected getQuestionTitle(mode: ChronoQuestionMode): string {
    switch (mode) {
      case 'country-to-flag':
        return this.i18n.t('classic.chrono.question.countryToFlag');
      case 'flag-to-country':
        return this.i18n.t('classic.chrono.question.flagToCountry');
      case 'capital-to-flag':
        return this.i18n.t('classic.chrono.question.capitalToFlag');
    }
  }

  protected getQuestionHeadline(question: ChronoQuestion): string {
    switch (question.mode) {
      case 'country-to-flag':
        return this.countryName(question.promptCountry);
      case 'flag-to-country':
        return this.i18n.t('classic.chrono.mysteryFlag');
      case 'capital-to-flag':
        return this.capitalName(question.promptCountry);
    }
  }

  protected getQuestionHint(question: ChronoQuestion): string {
    switch (question.mode) {
      case 'country-to-flag':
        return this.i18n.t('classic.chrono.hint.capital', {
          capital: this.capitalName(question.promptCountry)
        });
      case 'flag-to-country':
        return this.i18n.t('classic.chrono.hint.capital', {
          capital: this.capitalName(question.promptCountry)
        });
      case 'capital-to-flag':
        return this.i18n.t('classic.chrono.hint.countryLength', {
          length: this.countryName(question.promptCountry).length
        });
    }
  }

  protected getDifficultyLabel(difficulty: GameDifficulty): string {
    return difficulty === 'hard' ? this.i18n.t('common.hard') : this.i18n.t('common.easy');
  }

  protected getErrorPrompt(error: ChronoError): string {
    switch (error.question.mode) {
      case 'country-to-flag':
        return this.i18n.t('classic.chrono.promptCountry', {
          country: this.countryName(error.question.promptCountry)
        });
      case 'flag-to-country':
        return this.i18n.t('classic.chrono.mysteryFlag');
      case 'capital-to-flag':
        return this.i18n.t('classic.chrono.promptCapital', {
          capital: this.capitalName(error.question.promptCountry)
        });
    }
  }

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }

  protected capitalName(country: CountrySummary): string {
    return this.i18n.capitalName(country);
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private startGame(): void {
    this.clearTimers();
    this.clearProgress();
    this.score.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.questionNumber.set(0);
    this.correctCount.set(0);
    this.wrongCount.set(0);
    this.answered.set(false);
    this.selectedCode.set(null);
    this.timeLeft.set(GAME_DURATION_SECONDS);
    this.isComplete.set(false);
    this.errors.set([]);
    this.feedback.set(null);
    this.askedCodes.set([]);
    this.lastMode.set(null);
    this.hasSavedRecord = false;
    this.startTimer();
    this.generateQuestion();
  }

  private generateQuestion(): void {
    if (this.isComplete()) {
      return;
    }

    const countries = this.countriesSignal();
    if (countries.length < 4) {
      return;
    }

    const excludeCodes = this.computeExcludeCodes(countries.length);
    const mode = this.pickQuestionMode();
    const difficulty = this.pickDifficulty();

    if (mode === 'flag-to-country') {
      const question = this.flagQuizService.buildCountryNameQuestion(countries, difficulty, excludeCodes);
      this.currentQuestion.set({
        mode,
        difficulty,
        promptCountry: question.promptCountry,
        options: question.options,
        correctCode: question.correctCode
      });
    } else {
      const question = this.flagQuizService.buildQuestion(countries, difficulty, excludeCodes);
      this.currentQuestion.set({
        mode,
        difficulty,
        promptCountry: question.promptCountry,
        options: question.options,
        correctCode: question.correctCode
      });
    }

    const current = this.currentQuestion();
    if (current) {
      this.askedCodes.update((codes) => [...codes, current.correctCode]);
    }

    this.questionNumber.update((value) => value + 1);
    this.answered.set(false);
    this.selectedCode.set(null);
    this.lastMode.set(mode);
  }

  private computeExcludeCodes(countryCount: number): string[] {
    const asked = this.askedCodes();
    if (countryCount - asked.length < 4) {
      this.askedCodes.set([]);
      return [];
    }

    return asked;
  }

  private pickQuestionMode(): ChronoQuestionMode {
    const allModes: ChronoQuestionMode[] = ['country-to-flag', 'flag-to-country', 'capital-to-flag'];
    const previous = this.lastMode();
    const nonRepeatedModes = previous
      ? allModes.filter((mode) => mode !== previous)
      : allModes;
    const pool = nonRepeatedModes.length > 0 && Math.random() < 0.85 ? nonRepeatedModes : allModes;

    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pickDifficulty(): GameDifficulty {
    return Math.random() < 0.58 ? 'hard' : 'easy';
  }

  private computePoints(difficulty: GameDifficulty, streak: number): number {
    const base = difficulty === 'hard' ? 130 : 95;
    const comboBonus = Math.min(5, Math.max(streak - 1, 0)) * 20;
    return base + comboBonus;
  }

  private scheduleNextQuestion(): void {
    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId);
    }

    this.advanceTimeoutId = window.setTimeout(() => {
      this.advanceTimeoutId = null;
      this.generateQuestion();
    }, QUESTION_SWITCH_DELAY_MS);
  }

  private showFeedback(kind: 'correct' | 'wrong', message: string): void {
    this.feedback.set({ kind, message });

    if (this.feedbackTimeoutId !== null) {
      window.clearTimeout(this.feedbackTimeoutId);
    }

    this.feedbackTimeoutId = window.setTimeout(() => {
      this.feedback.set(null);
      this.feedbackTimeoutId = null;
    }, 1400);
  }

  private startTimer(): void {
    this.startTimerWithSeconds(GAME_DURATION_SECONDS);
  }

  private startTimerWithSeconds(seconds: number): void {
    const safeSeconds = Math.max(0, Math.min(MAX_DURATION_SECONDS, Math.round(seconds)));
    this.timerDeadlineMs = Date.now() + safeSeconds * 1000;
    this.timeLeft.set(safeSeconds);

    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
    }

    this.timerIntervalId = window.setInterval(() => {
      this.syncTimeLeft();
    }, TIMER_REFRESH_MS);
  }

  private syncTimeLeft(): void {
    if (this.timerDeadlineMs === null || this.isComplete()) {
      return;
    }

    const remaining = Math.max(0, Math.ceil((this.timerDeadlineMs - Date.now()) / 1000));
    this.timeLeft.set(remaining);

    if (remaining <= 0) {
      this.finishGame();
    }
  }

  private subtractTime(seconds: number): void {
    if (this.timerDeadlineMs === null || this.isComplete()) {
      return;
    }

    const now = Date.now();
    const updatedDeadline = Math.max(now, this.timerDeadlineMs - seconds * 1000);
    this.timerDeadlineMs = updatedDeadline;
    this.syncTimeLeft();
  }

  private addTime(seconds: number): void {
    if (this.timerDeadlineMs === null || this.isComplete()) {
      return;
    }

    const now = Date.now();
    const maxDeadline = now + MAX_DURATION_SECONDS * 1000;
    this.timerDeadlineMs = Math.min(maxDeadline, this.timerDeadlineMs + seconds * 1000);
    this.syncTimeLeft();
  }

  private finishGame(): void {
    if (this.isComplete()) {
      return;
    }

    this.isComplete.set(true);
    this.answered.set(true);
    this.feedback.set(null);

    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId);
      this.advanceTimeoutId = null;
    }

    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    if (!this.hasSavedRecord) {
      this.personalRecordsService.saveResult('chrono-flags', {
        score: this.score(),
        maxScore: Math.max(1, this.score()),
        percentOverride: this.accuracy(),
        streak: this.bestStreak()
      });
      this.hasSavedRecord = true;
    }

    this.clearProgress();
  }

  private clearTimers(): void {
    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId);
      this.advanceTimeoutId = null;
    }

    if (this.feedbackTimeoutId !== null) {
      window.clearTimeout(this.feedbackTimeoutId);
      this.feedbackTimeoutId = null;
    }
  }

  private formatTimer(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private buildProgressSnapshot(): ChronoProgressSnapshot {
    return {
      version: 1,
      score: this.score(),
      streak: this.streak(),
      bestStreak: this.bestStreak(),
      questionNumber: this.questionNumber(),
      correctCount: this.correctCount(),
      wrongCount: this.wrongCount(),
      answered: this.answered(),
      selectedCode: this.selectedCode(),
      timeLeft: this.timeLeft(),
      askedCodes: [...this.askedCodes()],
      lastMode: this.lastMode(),
      currentQuestion: this.currentQuestion()
        ? this.questionToSnapshot(this.currentQuestion()!)
        : null,
      errors: this.errors().map((error) => ({
        question: this.questionToSnapshot(error.question),
        selectedCode: error.selectedCountry?.code ?? null,
        correctCode: error.correctCountry.code
      }))
    };
  }

  private restoreProgress(countries: CountrySummary[]): boolean {
    const snapshot = this.gameProgressService.getPayload<ChronoProgressSnapshot>(
      ChronoFlagsGamePageComponent.PROGRESS_GAME_ID
    );
    if (!snapshot || snapshot.version !== 1) {
      return false;
    }
    if (snapshot.timeLeft <= 0) {
      this.clearProgress();
      return false;
    }

    const byCode = new Map(countries.map((country) => [country.code, country]));
    const hydratedQuestion = this.snapshotToQuestion(snapshot.currentQuestion, byCode);
    if (!hydratedQuestion) {
      return false;
    }

    this.score.set(snapshot.score);
    this.streak.set(snapshot.streak);
    this.bestStreak.set(snapshot.bestStreak);
    this.questionNumber.set(snapshot.questionNumber);
    this.correctCount.set(snapshot.correctCount);
    this.wrongCount.set(snapshot.wrongCount);
    this.answered.set(false);
    this.selectedCode.set(null);
    this.timeLeft.set(snapshot.timeLeft);
    this.isComplete.set(false);
    this.feedback.set(null);
    this.askedCodes.set(snapshot.askedCodes);
    this.lastMode.set(snapshot.lastMode);
    this.currentQuestion.set(hydratedQuestion);
    this.errors.set(
      snapshot.errors
        .map((error) => {
          const question = this.snapshotToQuestion(error.question, byCode);
          const correctCountry = byCode.get(error.correctCode) ?? null;
          if (!question || !correctCountry) {
            return null;
          }

          return {
            question,
            selectedCountry: error.selectedCode ? byCode.get(error.selectedCode) ?? null : null,
            correctCountry
          };
        })
        .filter((error): error is ChronoError => !!error)
    );
    this.hasSavedRecord = false;
    this.startTimerWithSeconds(snapshot.timeLeft);
    return true;
  }

  private questionToSnapshot(question: ChronoQuestion): ChronoQuestionSnapshot {
    return {
      mode: question.mode,
      difficulty: question.difficulty,
      promptCode: question.promptCountry.code,
      optionCodes: question.options.map((option) => option.code),
      correctCode: question.correctCode
    };
  }

  private snapshotToQuestion(
    snapshot: ChronoQuestionSnapshot | null,
    byCode: Map<string, CountrySummary>
  ): ChronoQuestion | null {
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

    return {
      mode: snapshot.mode,
      difficulty: snapshot.difficulty,
      promptCountry,
      options,
      correctCode: snapshot.correctCode
    };
  }

  private clearProgress(): void {
    this.gameProgressService.clearProgress(ChronoFlagsGamePageComponent.PROGRESS_GAME_ID);
  }
}

