import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CountryShape } from '../models/country-shape';
import { CountrySummary } from '../models/country-summary';
import {
  SPEEDRUN_ERROR_PENALTY_MS,
  SPEEDRUN_SPLITS,
  SPEEDRUN_TOTAL_QUESTIONS,
  SpeedrunMistake,
  SpeedrunQuestion,
  SpeedrunQuestionMode,
  SpeedrunRunResult,
  SpeedrunSplit,
  SpeedrunSplitResult,
  buildSpeedrunResult,
  buildSpeedrunSplitResult,
  formatSpeedrunTime,
} from '../models/speedrun';
import { CountriesService } from '../services/countries.service';
import { CountryShapesService } from '../services/country-shapes.service';
import { BrowserStorageService } from '../services/browser-storage.service';
import { FlagQuizService } from '../services/flag-quiz.service';
import { I18nService } from '../services/i18n.service';
import {
  SpeedrunLeaderboardEntry,
  SpeedrunLeaderboardService,
} from '../services/speedrun-leaderboard.service';
import { SpeedrunRecordsService } from '../services/speedrun-records.service';
import { SpeedrunRunSubmissionService } from '../services/speedrun-run-submission.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { shuffleItems } from '../utils/array-utils';
import { DEFAULT_SHAPE_VIEWBOX, buildCountryShapeLookup } from '../utils/country-shape-viewbox';

type SpeedrunState = 'intro' | 'countdown' | 'running' | 'finished';
type SpeedrunRankingState = 'idle' | 'local' | 'pending' | 'accepted' | 'failed';
type PromptMode = 'flag-options' | 'name-options';
type PendingGuestSpeedrun = {
  result: SpeedrunRunResult;
  splitResults: SpeedrunSplitResult[];
  savedAt: string;
};

const TICK_MS = 80;
const NEXT_STEP_DELAY_MS = 520;
const COUNTDOWN_SECONDS = 3;
const PENDING_GUEST_SPEEDRUN_KEY = 'vexiio.speedrun.pendingGuestResult.v1';
const SPEEDRUN_LEADERBOARD_LIMIT = 20;
const SPEEDRUN_LEADERBOARD_PAGE_SIZE = 5;

@Component({
  selector: 'app-speedrun-page',
  imports: [RouterLink],
  templateUrl: './speedrun-page.component.html',
  styleUrl: './speedrun-page.component.scss',
})
export class SpeedrunPageComponent implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(SupabaseAuthService);
  private readonly countriesService = inject(CountriesService);
  private readonly countryShapesService = inject(CountryShapesService);
  private readonly storage = inject(BrowserStorageService);
  private readonly flagQuizService = inject(FlagQuizService);
  private readonly records = inject(SpeedrunRecordsService);
  private readonly runSubmission = inject(SpeedrunRunSubmissionService);
  protected readonly leaderboard = inject(SpeedrunLeaderboardService);

  private timerIntervalId: number | null = null;
  private countdownIntervalId: number | null = null;
  private nextStepTimeoutId: number | null = null;
  private splitStartedAtMs = 0;
  private completedRawTimeMs = 0;
  private attemptId: string | null = null;
  private readonly askedCodesBySplit = new Map<string, string[]>();

  protected readonly countries = toSignal(this.countriesService.getCountries(), {
    initialValue: [] as CountrySummary[],
  });
  protected readonly shapes = toSignal(this.countryShapesService.getCountryShapes(), {
    initialValue: [] as CountryShape[],
  });
  protected readonly state = signal<SpeedrunState>('intro');
  protected readonly countdown = signal(COUNTDOWN_SECONDS);
  protected readonly splitIndex = signal(0);
  protected readonly questionIndex = signal(0);
  protected readonly question = signal<SpeedrunQuestion | null>(null);
  protected readonly selectedCode = signal<string | null>(null);
  protected readonly answered = signal(false);
  protected readonly elapsedMs = signal(0);
  protected readonly splitElapsedMs = signal(0);
  protected readonly splitMistakeStartCount = signal(0);
  protected readonly mistakes = signal<SpeedrunMistake[]>([]);
  protected readonly splitResults = signal<SpeedrunSplitResult[]>([]);
  protected readonly result = signal<SpeedrunRunResult | null>(null);
  protected readonly savedBestTimeMs = signal<number | null>(null);
  protected readonly rankingState = signal<SpeedrunRankingState>('idle');
  protected readonly pendingGuestSaveCompleted = signal(false);
  protected readonly leaderboardSearch = signal('');
  protected readonly leaderboardPage = signal(1);
  protected readonly leaderboardPageSize = SPEEDRUN_LEADERBOARD_PAGE_SIZE;

  protected readonly splits = SPEEDRUN_SPLITS;
  protected readonly totalQuestions = SPEEDRUN_TOTAL_QUESTIONS;
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly isRunning = computed(() => this.state() === 'running');
  protected readonly shapeByCode = computed(() => buildCountryShapeLookup(this.shapes()));
  protected readonly playableShapeCountries = computed(() => {
    const shapeCodes = new Set(this.shapes().map((shape) => shape.code));
    return this.countries().filter((country) => shapeCodes.has(country.code));
  });
  protected readonly capitalCountries = computed(() =>
    this.countries().filter((country) => this.i18n.capitalName(country).trim().length > 0),
  );
  protected readonly isReady = computed(
    () =>
      this.countries().length >= 4 &&
      this.capitalCountries().length >= 4 &&
      this.playableShapeCountries().length >= 4,
  );
  protected readonly currentSplit = computed(
    () => this.splits[this.splitIndex()] ?? this.splits[0],
  );
  protected readonly currentQuestionNumber = computed(() =>
    Math.min(this.questionIndex() + 1, this.currentSplit().questionCount),
  );
  protected readonly completedQuestionCount = computed(
    () =>
      this.splitResults().reduce(
        (total, split) => total + this.getSplitById(split.splitId).questionCount,
        0,
      ) + (this.state() === 'running' ? this.questionIndex() : 0),
  );
  protected readonly progressPercent = computed(() =>
    Math.round((this.completedQuestionCount() / this.totalQuestions) * 100),
  );
  protected readonly timerLabel = computed(() => formatSpeedrunTime(this.elapsedMs()));
  protected readonly currentSplitMistakeCount = computed(() =>
    Math.max(0, this.mistakes().length - this.splitMistakeStartCount()),
  );
  protected readonly currentSplitTotalMs = computed(
    () => this.splitElapsedMs() + this.currentSplitMistakeCount() * SPEEDRUN_ERROR_PENALTY_MS,
  );
  protected readonly currentSplitTimerLabel = computed(() =>
    formatSpeedrunTime(this.currentSplitTotalMs()),
  );
  protected readonly completedTotalTimeMs = computed(() =>
    this.splitResults().reduce((total, split) => total + split.totalTimeMs, 0),
  );
  protected readonly penaltyLabel = computed(() =>
    formatSpeedrunTime(this.mistakes().length * SPEEDRUN_ERROR_PENALTY_MS),
  );
  protected readonly bestRecord = computed(() => this.records.getBestForUser(this.auth.user()?.id));
  protected readonly theoreticalBestMs = computed(() => {
    this.records.snapshot();
    return this.records.getTheoreticalBestForUser(this.auth.user()?.id);
  });
  protected readonly theoreticalBestLabel = computed(() => {
    const best = this.theoreticalBestMs();
    return best === null ? this.i18n.t('common.none') : formatSpeedrunTime(best);
  });
  protected readonly bestPossibleMs = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return null;
    }

    const currentIndex = this.splitIndex();
    const remainingBestMs = this.splits
      .slice(currentIndex + 1)
      .map((split) => this.records.getBestSplitForUser(userId, split.id)?.totalTimeMs ?? null);

    if (remainingBestMs.some((value) => value === null)) {
      return null;
    }

    return (
      this.completedTotalTimeMs() +
      (this.state() === 'running' ? this.currentSplitTotalMs() : 0) +
      remainingBestMs.reduce<number>((total, value) => total + (value ?? 0), 0)
    );
  });
  protected readonly bestPossibleLabel = computed(() => {
    const bestPossible = this.bestPossibleMs();
    return bestPossible === null ? this.i18n.t('common.none') : formatSpeedrunTime(bestPossible);
  });
  protected readonly previousSegmentLabel = computed(() => {
    const previous = this.splitResults().at(-1);
    return previous ? this.getSplitDeltaLabel(previous) : this.i18n.t('common.none');
  });
  protected readonly topLeaderboardEntries = computed(() =>
    this.leaderboard.entries().slice(0, SPEEDRUN_LEADERBOARD_LIMIT),
  );
  protected readonly filteredLeaderboardEntries = computed(() => {
    const search = this.normalizeSearch(this.leaderboardSearch());
    const entries = this.topLeaderboardEntries();

    if (!search) {
      return entries;
    }

    return entries.filter((entry) => this.normalizeSearch(entry.displayName).includes(search));
  });
  protected readonly leaderboardPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredLeaderboardEntries().length / this.leaderboardPageSize)),
  );
  protected readonly visibleLeaderboardEntries = computed(() => {
    const page = Math.min(this.leaderboardPage(), this.leaderboardPageCount());
    const start = (page - 1) * this.leaderboardPageSize;
    return this.filteredLeaderboardEntries().slice(start, start + this.leaderboardPageSize);
  });
  protected readonly leaderboardPageLabel = computed(() =>
    this.i18n.t('speedrun.leaderboardPage', {
      current: Math.min(this.leaderboardPage(), this.leaderboardPageCount()),
      total: this.leaderboardPageCount(),
    }),
  );

  constructor() {
    void this.leaderboard.refresh(SPEEDRUN_LEADERBOARD_LIMIT);

    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId) {
        return;
      }

      this.consumePendingGuestSpeedrun(userId);
    });
  }

  protected async startRun(): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    this.clearTimers();
    this.state.set('countdown');
    this.countdown.set(COUNTDOWN_SECONDS);
    this.splitIndex.set(0);
    this.questionIndex.set(0);
    this.question.set(null);
    this.selectedCode.set(null);
    this.answered.set(false);
    this.elapsedMs.set(0);
    this.splitElapsedMs.set(0);
    this.completedRawTimeMs = 0;
    this.splitMistakeStartCount.set(0);
    this.mistakes.set([]);
    this.splitResults.set([]);
    this.result.set(null);
    this.savedBestTimeMs.set(null);
    this.pendingGuestSaveCompleted.set(false);
    this.askedCodesBySplit.clear();
    this.rankingState.set(this.isAuthenticated() ? 'pending' : 'local');
    this.attemptId = null;

    if (this.isAuthenticated()) {
      try {
        const attempt = await this.runSubmission.startAttempt();
        this.attemptId = attempt.attemptId;
      } catch (error) {
        console.warn('Unable to start ranked speedrun attempt', error);
        this.rankingState.set('local');
      }
    }

    this.countdownIntervalId = window.setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);

      if (next <= 0) {
        this.clearCountdown();
        this.startCurrentSplit();
      }
    }, 1000);
  }

  protected restartRun(): void {
    void this.startRun();
  }

  protected async signInToSaveResult(finalResult: SpeedrunRunResult): Promise<void> {
    this.storage.setJson<PendingGuestSpeedrun>(PENDING_GUEST_SPEEDRUN_KEY, {
      result: finalResult,
      splitResults: this.splitResults(),
      savedAt: new Date().toISOString(),
    });

    await this.auth.signInWithGoogle();
  }

  protected selectAnswer(code: string): void {
    const question = this.question();
    if (!question || this.answered() || this.state() !== 'running') {
      return;
    }

    this.selectedCode.set(code);
    this.answered.set(true);

    if (code !== question.correctCode) {
      const selectedCountry = question.options.find((country) => country.code === code) ?? null;
      const correctCountry =
        question.options.find((country) => country.code === question.correctCode) ??
        question.promptCountry;
      this.mistakes.update((mistakes) => [
        ...mistakes,
        {
          split: question.split,
          questionNumber: question.questionNumber,
          promptCountryName: this.getQuestionHeadline(question),
          selectedCountryName: selectedCountry ? this.countryName(selectedCountry) : null,
          correctCountryName: this.countryName(correctCountry),
        },
      ]);
    }

    this.nextStepTimeoutId = window.setTimeout(() => {
      this.nextStepTimeoutId = null;
      this.advance();
    }, NEXT_STEP_DELAY_MS);
  }

  protected getOptionState(code: string): 'default' | 'correct' | 'wrong' {
    const question = this.question();
    if (!question || !this.answered()) {
      return 'default';
    }

    if (code === question.correctCode) {
      return 'correct';
    }

    return code === this.selectedCode() ? 'wrong' : 'default';
  }

  protected getModeTitle(mode: SpeedrunQuestionMode): string {
    switch (mode) {
      case 'country-to-flag':
        return this.i18n.t('speedrun.mode.countryToFlag');
      case 'flag-to-country':
        return this.i18n.t('speedrun.mode.flagToCountry');
      case 'capital-to-country':
        return this.i18n.t('speedrun.mode.capitalToCountry');
      case 'shape-to-country':
        return this.i18n.t('speedrun.mode.shapeToCountry');
    }
  }

  protected getQuestionHeadline(question: SpeedrunQuestion): string {
    switch (question.split.mode) {
      case 'flag-to-country':
        return this.i18n.t('speedrun.mysteryFlag');
      case 'capital-to-country':
        return this.i18n.capitalName(question.promptCountry);
      case 'shape-to-country':
        return this.i18n.t('speedrun.mysteryShape');
      case 'country-to-flag':
        return this.countryName(question.promptCountry);
    }
  }

  protected getPromptMode(question: SpeedrunQuestion): PromptMode {
    return question.split.mode === 'country-to-flag' ? 'flag-options' : 'name-options';
  }

  protected countryName(country: CountrySummary): string {
    return this.i18n.countryName(country);
  }

  protected formatTime(milliseconds: number): string {
    return formatSpeedrunTime(milliseconds);
  }

  protected setLeaderboardSearch(value: string): void {
    this.leaderboardSearch.set(value);
    this.leaderboardPage.set(1);
  }

  protected previousLeaderboardPage(): void {
    this.leaderboardPage.update((page) => Math.max(1, page - 1));
  }

  protected nextLeaderboardPage(): void {
    this.leaderboardPage.update((page) => Math.min(this.leaderboardPageCount(), page + 1));
  }

  protected rankLabel(entry: SpeedrunLeaderboardEntry): string {
    const rank = this.topLeaderboardEntries().findIndex(
      (candidate) => candidate.userId === entry.userId,
    );
    return rank === -1 ? '-' : `#${rank + 1}`;
  }

  protected displayInitials(entry: SpeedrunLeaderboardEntry): string {
    const initials = entry.displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase(this.i18n.locale()))
      .join('');

    return initials || '?';
  }

  protected formatLeaderboardMeta(entry: SpeedrunLeaderboardEntry): string {
    return this.i18n.t('speedrun.leaderboardEntryMeta', {
      errors: entry.mistakeCount,
      correct: entry.correctCount,
    });
  }

  protected getFinishedSplit(split: SpeedrunSplit): SpeedrunSplitResult | null {
    return this.splitResults().find((result) => result.splitId === split.id) ?? null;
  }

  protected getSplitTimeLabel(split: SpeedrunSplit): string {
    const result = this.getFinishedSplit(split);
    if (result) {
      return formatSpeedrunTime(result.totalTimeMs);
    }

    return this.currentSplit().id === split.id && this.state() === 'running'
      ? this.currentSplitTimerLabel()
      : this.i18n.t('common.none');
  }

  protected getSplitBestLabel(split: SpeedrunSplit): string {
    const best = this.records.getBestSplitForUser(this.auth.user()?.id, split.id);
    return best ? formatSpeedrunTime(best.totalTimeMs) : this.i18n.t('common.none');
  }

  protected getSplitDeltaLabel(result: SpeedrunSplitResult): string {
    if (result.deltaMs === null) {
      return this.i18n.t('speedrun.split.newBest');
    }

    const sign = result.deltaMs <= 0 ? '-' : '+';
    return `${sign}${formatSpeedrunTime(Math.abs(result.deltaMs))}`;
  }

  protected getSplitStateClass(split: SpeedrunSplit): string {
    const result = this.getFinishedSplit(split);
    if (!result && this.currentSplit().id === split.id && this.state() === 'running') {
      return 'is-current';
    }

    if (!result) {
      return 'is-pending';
    }

    if (result.deltaMs === null) {
      return 'is-new';
    }

    return result.isImprovement ? 'is-improved' : 'is-slower';
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private startCurrentSplit(): void {
    this.clearTimers();
    this.questionIndex.set(0);
    this.selectedCode.set(null);
    this.answered.set(false);
    this.splitElapsedMs.set(0);
    this.splitMistakeStartCount.set(this.mistakes().length);
    this.splitStartedAtMs = performance.now();
    this.generateQuestion();
    this.state.set('running');
    this.timerIntervalId = window.setInterval(() => {
      const splitElapsed = performance.now() - this.splitStartedAtMs;
      this.splitElapsedMs.set(splitElapsed);
      this.elapsedMs.set(
        this.completedTotalTimeMs() +
          splitElapsed +
          this.currentSplitMistakeCount() * SPEEDRUN_ERROR_PENALTY_MS,
      );
    }, TICK_MS);
  }

  private advance(): void {
    if (this.questionIndex() >= this.currentSplit().questionCount - 1) {
      this.completeCurrentSplit();
      return;
    }

    this.questionIndex.update((index) => index + 1);
    this.generateQuestion();
  }

  private completeCurrentSplit(): void {
    const split = this.currentSplit();
    const rawTimeMs = performance.now() - this.splitStartedAtMs;
    const completedAt = new Date().toISOString();
    const mistakeCount = this.mistakes().length - this.splitMistakeStartCount();
    const bestBefore =
      this.records.getBestSplitForUser(this.auth.user()?.id, split.id)?.totalTimeMs ?? null;
    const splitResult = buildSpeedrunSplitResult(
      split,
      rawTimeMs,
      mistakeCount,
      bestBefore,
      completedAt,
    );

    this.completedRawTimeMs += splitResult.rawTimeMs;
    this.elapsedMs.set(this.completedTotalTimeMs() + splitResult.totalTimeMs);
    this.splitElapsedMs.set(splitResult.rawTimeMs);
    this.splitResults.update((results) => [...results, splitResult]);
    this.clearTimerInterval();
    this.question.set(null);
    this.selectedCode.set(null);
    this.answered.set(false);

    if (this.splitIndex() >= this.splits.length - 1) {
      this.finishRun();
      return;
    }

    this.splitIndex.update((index) => Math.min(index + 1, this.splits.length - 1));
    this.questionIndex.set(0);
    this.startCurrentSplit();
  }

  private finishRun(): void {
    if (this.state() === 'finished') {
      return;
    }

    this.clearTimers();
    const finalResult = buildSpeedrunResult(
      this.completedRawTimeMs,
      this.mistakes().length,
      new Date().toISOString(),
      this.splitResults(),
    );
    this.result.set(finalResult);
    this.state.set('finished');

    const userId = this.auth.user()?.id;
    if (userId) {
      const savedRecord = this.records.saveBestForUser(userId, finalResult);
      this.records.saveSplitBestsForUser(userId, this.splitResults());
      this.savedBestTimeMs.set(savedRecord.totalTimeMs);
    }

    if (this.attemptId) {
      void this.submitRankedRun(this.attemptId, finalResult);
    }
  }

  private generateQuestion(): void {
    const split = this.currentSplit();
    const basePool = this.getQuestionPool(split);
    if (!split || basePool.length < 4) {
      return;
    }

    const excludeCodes = this.computeExcludeCodes(split, basePool.length);
    const baseQuestion =
      split.mode === 'country-to-flag'
        ? this.flagQuizService.buildQuestion(basePool, split.difficulty, excludeCodes)
        : this.flagQuizService.buildCountryNameQuestion(basePool, split.difficulty, excludeCodes);
    const shape =
      split.mode === 'shape-to-country'
        ? this.shapeByCode().get(baseQuestion.promptCountry.code)
        : null;

    this.question.set({
      split,
      questionNumber: this.questionIndex() + 1,
      promptCountry: baseQuestion.promptCountry,
      options: shuffleItems(baseQuestion.options),
      correctCode: baseQuestion.correctCode,
      shapePath: shape?.path,
      shapeViewBox: shape?.viewBox ?? DEFAULT_SHAPE_VIEWBOX,
    });
    this.rememberAskedCode(split, baseQuestion.correctCode);
    this.selectedCode.set(null);
    this.answered.set(false);
  }

  private getQuestionPool(split: SpeedrunSplit): CountrySummary[] {
    if (split.mode === 'capital-to-country') {
      return this.capitalCountries();
    }

    if (split.mode === 'shape-to-country') {
      return this.playableShapeCountries();
    }

    return this.countries();
  }

  private computeExcludeCodes(split: SpeedrunSplit, countryCount: number): string[] {
    const asked = this.askedCodesBySplit.get(split.id) ?? [];
    if (countryCount - asked.length < 4) {
      this.askedCodesBySplit.set(split.id, []);
      return [];
    }

    return asked;
  }

  private rememberAskedCode(split: SpeedrunSplit, code: string): void {
    this.askedCodesBySplit.set(split.id, [...(this.askedCodesBySplit.get(split.id) ?? []), code]);
  }

  private getSplitById(splitId: string): SpeedrunSplit {
    return this.splits.find((split) => split.id === splitId) ?? this.splits[0];
  }

  private clearTimers(): void {
    this.clearTimerInterval();
    this.clearCountdown();

    if (this.nextStepTimeoutId !== null) {
      window.clearTimeout(this.nextStepTimeoutId);
      this.nextStepTimeoutId = null;
    }
  }

  private clearTimerInterval(): void {
    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private clearCountdown(): void {
    if (this.countdownIntervalId !== null) {
      window.clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private consumePendingGuestSpeedrun(userId: string): void {
    const pending = this.storage.getJson<PendingGuestSpeedrun | null>(
      PENDING_GUEST_SPEEDRUN_KEY,
      null,
    );
    if (!pending?.result) {
      return;
    }

    const savedRecord = this.records.saveBestForUser(userId, pending.result);
    this.records.saveSplitBestsForUser(userId, pending.splitResults ?? []);
    this.savedBestTimeMs.set(savedRecord.totalTimeMs);
    this.pendingGuestSaveCompleted.set(true);
    this.storage.remove(PENDING_GUEST_SPEEDRUN_KEY);
  }

  private async submitRankedRun(attemptId: string, result: SpeedrunRunResult): Promise<void> {
    this.rankingState.set('pending');

    try {
      await this.runSubmission.submitAttempt(attemptId, result, {
        version: 2,
        splitResults: this.splitResults(),
        mistakes: this.mistakes().map((mistake) => ({
          splitId: mistake.split.id,
          questionNumber: mistake.questionNumber,
          promptCountryName: mistake.promptCountryName,
          selectedCountryName: mistake.selectedCountryName,
          correctCountryName: mistake.correctCountryName,
        })),
      });
      this.rankingState.set('accepted');
      void this.leaderboard.refresh(SPEEDRUN_LEADERBOARD_LIMIT);
    } catch (error) {
      console.warn('Unable to submit ranked speedrun result', error);
      this.rankingState.set('failed');
    }
  }

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase(this.i18n.locale())
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
