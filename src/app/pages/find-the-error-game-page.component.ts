import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameId } from '../data/game-catalog';
import { FLAG_REBUILD_PUZZLES } from '../data/flag-rebuild-puzzles';
import { FlagRebuildPattern, FlagRebuildPuzzle } from '../models/flag-rebuild-puzzle';
import { GameProgressService } from '../services/game-progress.service';
import { I18nService } from '../services/i18n.service';
import { PersonalRecordsService } from '../services/personal-records.service';

type ErrorPuzzle = {
  puzzle: FlagRebuildPuzzle;
  wrongZoneIndex: number;
  displayedColors: string[];
  wrongColor: string;
  correctColor: string;
};

type GameError = {
  puzzle: FlagRebuildPuzzle;
  wrongColor: string;
  correctColor: string;
};

const EXTRA_COLORS = [
  '#ff004f',
  '#ff6b00',
  '#ffc300',
  '#19b24b',
  '#00a8e8',
  '#0057ff',
  '#6f2cff',
  '#d100d1',
  '#8b0000',
  '#0a0a0a',
  '#f8f9fa'
];
const MIN_WRONG_COLOR_DISTANCE = 120;
const MIN_DISPLAY_COLOR_DISTANCE = 90;
const RECENT_WRONG_COLORS_LIMIT = 10;

type ErrorPuzzleSnapshot = {
  puzzleCode: string;
  wrongZoneIndex: number;
  displayedColors: string[];
  wrongColor: string;
  correctColor: string;
};

type FindErrorProgressSnapshot = {
  version: 1;
  gamePuzzleCodes: string[];
  puzzleIndex: number;
  score: number;
  isLocked: boolean;
  errors: Array<{
    puzzleCode: string;
    wrongColor: string;
    correctColor: string;
  }>;
  currentErrorPuzzle: ErrorPuzzleSnapshot | null;
};

@Component({
  selector: 'app-find-the-error-game-page',
  imports: [RouterLink],
  templateUrl: './find-the-error-game-page.component.html',
  styleUrl: './find-the-error-game-page.component.css'
})
export class FindTheErrorGamePageComponent implements OnDestroy {
  private static readonly PROGRESS_GAME_ID: GameId = 'find-the-error';
  protected readonly i18n = inject(I18nService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private readonly gameProgressService = inject(GameProgressService);
  private readonly englishRegionNames = this.createEnglishRegionNames();
  protected readonly allPuzzles = FLAG_REBUILD_PUZZLES;
  protected readonly gamePuzzles = signal<FlagRebuildPuzzle[]>([]);
  protected readonly puzzleIndex = signal(0);
  protected readonly score = signal(0);
  protected readonly isLocked = signal(false);
  protected readonly errors = signal<GameError[]>([]);
  protected readonly isComplete = signal(false);
  protected readonly currentErrorPuzzle = signal<ErrorPuzzle | null>(null);
  private nextTimeoutId: number | null = null;
  private hasSavedRecord = false;
  private skipNextPuzzleInitialization = false;
  private readonly recentWrongColors: string[] = [];
  private readonly lastWrongZoneByPuzzle = new Map<string, number>();

  protected readonly totalPuzzles = computed(() => this.gamePuzzles().length);
  protected readonly currentPuzzle = computed(() => this.gamePuzzles()[this.puzzleIndex()] ?? null);
  protected readonly progressLabel = computed(() => `${this.score() + 1}`);
  protected readonly progressPercent = computed(() => {
    return 100;
  });
  protected readonly previewColorsForPattern = computed(() => {
    const current = this.currentErrorPuzzle();
    if (!current) {
      return [];
    }

    return this.getPatternPreviewColors(
      current.puzzle.targetPattern,
      current.displayedColors,
      current.puzzle.targetColors.length
    );
  });

  constructor() {
    if (!this.restoreProgress()) {
      this.startNewGame();
    }

    effect(() => {
      const puzzle = this.currentPuzzle();
      if (!puzzle) {
        return;
      }

      if (this.skipNextPuzzleInitialization) {
        this.skipNextPuzzleInitialization = false;
        return;
      }

      this.isLocked.set(false);
      this.currentErrorPuzzle.set(this.buildErrorPuzzle(puzzle));
    });

    effect(() => {
      const current = this.currentErrorPuzzle();
      if (!current || this.isComplete()) {
        if (this.isComplete()) {
          this.clearProgress();
        }
        return;
      }

      this.gameProgressService.saveProgress(
        FindTheErrorGamePageComponent.PROGRESS_GAME_ID,
        this.buildProgressSnapshot(),
        {
          percent: Math.max(0, Math.min(99, this.score() * 10)),
          labelKey: 'home.resume.streak',
          labelParams: {
            score: this.score()
          }
        }
      );
    });
  }

  protected clickZone(index: number): void {
    const current = this.currentErrorPuzzle();
    if (!current || this.isLocked()) {
      return;
    }

    this.isLocked.set(true);

    if (index === current.wrongZoneIndex) {
      this.score.update((score) => score + 1);
      this.scheduleAdvance();
    } else {
      this.errors.update((errors) => [
        ...errors,
        {
          puzzle: current.puzzle,
          wrongColor: current.wrongColor,
          correctColor: current.correctColor
        }
      ]);
      this.scheduleGameOver();
    }
  }

  protected restartGame(): void {
    this.clearTimers();
    this.clearProgress();
    this.startNewGame();
  }

  protected closeSummary(): void {
    this.restartGame();
  }

  protected getMaxScore(): number {
    return Math.max(1, this.score() + this.errors().length);
  }

  protected countryName(puzzle: FlagRebuildPuzzle): string {
    if (this.i18n.isFrench()) {
      return puzzle.nameFrench;
    }

    return this.englishRegionNames?.of(puzzle.code.toUpperCase()) ?? puzzle.nameFrench;
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private buildErrorPuzzle(puzzle: FlagRebuildPuzzle): ErrorPuzzle {
    const zoneCount = this.getPatternZoneCount(puzzle.targetPattern, puzzle.targetColors.length);
    const displayedColors = this.getPatternPreviewColors(
      puzzle.targetPattern,
      puzzle.targetColors,
      puzzle.targetColors.length
    );
    const wrongZoneIndex = this.pickWrongZoneIndex(puzzle.code, zoneCount);
    const correctColor = displayedColors[wrongZoneIndex] ?? '#ffffff';
    const wrongColor = this.pickWrongColor(puzzle, displayedColors, correctColor);
    displayedColors[wrongZoneIndex] = wrongColor;

    return {
      puzzle,
      wrongZoneIndex,
      displayedColors,
      wrongColor,
      correctColor
    };
  }

  private pickWrongColor(
    puzzle: FlagRebuildPuzzle,
    displayedColors: string[],
    correctColor: string
  ): string {
    const normalizedDisplayed = displayedColors
      .map((color) => this.normalizeHexColor(color))
      .filter((color): color is string => !!color);
    const normalizedCorrect = this.normalizeHexColor(correctColor);
    if (!normalizedCorrect) {
      return correctColor;
    }

    const seededCandidates = [
      ...puzzle.palette,
      ...EXTRA_COLORS,
      ...this.buildDerivedCandidates(normalizedCorrect)
    ]
      .map((color) => this.normalizeHexColor(color))
      .filter((color): color is string => !!color);

    const uniqueCandidates = Array.from(new Set(seededCandidates)).filter((color) => color !== normalizedCorrect);
    const availableCandidates = uniqueCandidates.filter((color) => !normalizedDisplayed.includes(color));
    const distinctFromCorrect = availableCandidates.filter(
      (color) => this.rgbDistance(color, normalizedCorrect) >= MIN_WRONG_COLOR_DISTANCE
    );
    const distinctFromFlag = distinctFromCorrect.filter((color) =>
      normalizedDisplayed.every((displayedColor) => this.rgbDistance(color, displayedColor) >= MIN_DISPLAY_COLOR_DISTANCE)
    );
    const distinctAndFresh = distinctFromFlag.filter((color) => !this.recentWrongColors.includes(color));
    const fallbackFresh = distinctFromCorrect.filter((color) => !this.recentWrongColors.includes(color));

    const chosen = this.pickRandomFrom(
      distinctAndFresh,
      distinctFromFlag,
      fallbackFresh,
      distinctFromCorrect,
      availableCandidates
    );

    if (!chosen) {
      return correctColor;
    }

    this.rememberWrongColor(chosen);
    return chosen;
  }

  private advancePuzzle(): void {
    if (this.totalPuzzles() === 0) {
      return;
    }

    if (this.puzzleIndex() >= this.totalPuzzles() - 1) {
      this.gamePuzzles.set(this.shuffle([...this.allPuzzles]));
      this.puzzleIndex.set(0);
      return;
    }

    this.puzzleIndex.update((index) => index + 1);
  }

  private startNewGame(): void {
    this.gamePuzzles.set(this.shuffle([...this.allPuzzles]));
    this.puzzleIndex.set(0);
    this.score.set(0);
    this.errors.set([]);
    this.isComplete.set(false);
    this.isLocked.set(false);
    this.currentErrorPuzzle.set(null);
    this.hasSavedRecord = false;
    this.recentWrongColors.length = 0;
    this.lastWrongZoneByPuzzle.clear();
  }

  private getPatternPreviewColors(
    pattern: FlagRebuildPattern,
    sourceColors: string[],
    colorCount: number
  ): string[] {
    const zoneCount = this.getPatternZoneCount(pattern, colorCount);

    return Array.from({ length: zoneCount }, (_, index) => sourceColors[index] ?? '#ffffff');
  }

  private getPatternZoneCount(pattern: FlagRebuildPattern, colorCount: number): number {
    switch (pattern) {
      case 'left-band-horizontal':
        return Math.max(3, colorCount);
      case 'nordic-cross':
        return 2;
      case 'triangle-left-bands-2':
        return 3;
      case 'triangle-left-bands-3':
        return 4;
      default:
        return Math.max(2, colorCount);
    }
  }

  private pickWrongZoneIndex(puzzleCode: string, zoneCount: number): number {
    if (zoneCount <= 1) {
      this.lastWrongZoneByPuzzle.set(puzzleCode, 0);
      return 0;
    }

    const previousIndex = this.lastWrongZoneByPuzzle.get(puzzleCode);
    const candidateIndexes = Array.from({ length: zoneCount }, (_, index) => index).filter(
      (index) => index !== previousIndex
    );
    const nextIndex = candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)] ?? 0;
    this.lastWrongZoneByPuzzle.set(puzzleCode, nextIndex);
    return nextIndex;
  }

  private buildDerivedCandidates(baseColor: string): string[] {
    const rgb = this.hexToRgb(baseColor);
    const hsl = this.hexToHsl(baseColor);
    if (!rgb || !hsl) {
      return [];
    }

    const inverted = this.rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
    const complementary = this.hslToHex((hsl.h + 180) % 360, Math.max(72, hsl.s), this.shiftLightness(hsl.l, 12));
    const triadA = this.hslToHex((hsl.h + 120) % 360, Math.max(70, hsl.s), this.shiftLightness(hsl.l, 10));
    const triadB = this.hslToHex((hsl.h + 240) % 360, Math.max(70, hsl.s), this.shiftLightness(hsl.l, -10));
    const highLight = this.hslToHex(hsl.h, Math.max(68, hsl.s), 90);
    const deepDark = this.hslToHex(hsl.h, Math.max(68, hsl.s), 18);

    return [inverted, complementary, triadA, triadB, highLight, deepDark];
  }

  private pickRandomFrom(...groups: string[][]): string | null {
    for (const group of groups) {
      if (group.length > 0) {
        const shuffled = this.shuffle(group);
        return shuffled[0] ?? null;
      }
    }

    return null;
  }

  private rememberWrongColor(color: string): void {
    this.recentWrongColors.unshift(color);
    if (this.recentWrongColors.length > RECENT_WRONG_COLORS_LIMIT) {
      this.recentWrongColors.splice(RECENT_WRONG_COLORS_LIMIT);
    }
  }

  private normalizeHexColor(color: string): string | null {
    const trimmed = color.trim().toLowerCase();
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
    if (!match) {
      return null;
    }

    if (match[1].length === 3) {
      return `#${match[1]
        .split('')
        .map((char) => `${char}${char}`)
        .join('')}`;
    }

    return `#${match[1]}`;
  }

  private hexToRgb(color: string): { r: number; g: number; b: number } | null {
    const normalized = this.normalizeHexColor(color);
    if (!normalized) {
      return null;
    }

    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16)
    };
  }

  private rgbDistance(left: string, right: string): number {
    const a = this.hexToRgb(left);
    const b = this.hexToRgb(right);
    if (!a || !b) {
      return 0;
    }

    const r = a.r - b.r;
    const g = a.g - b.g;
    const bl = a.b - b.b;
    return Math.sqrt(r * r + g * g + bl * bl);
  }

  private hexToHsl(color: string): { h: number; s: number; l: number } | null {
    const rgb = this.hexToRgb(color);
    if (!rgb) {
      return null;
    }

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === r) {
        hue = ((g - b) / delta) % 6;
      } else if (max === g) {
        hue = (b - r) / delta + 2;
      } else {
        hue = (r - g) / delta + 4;
      }
    }

    hue = Math.round(((hue * 60) + 360) % 360);
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

    return {
      h: hue,
      s: Math.round(saturation * 100),
      l: Math.round(lightness * 100)
    };
  }

  private hslToHex(hue: number, saturation: number, lightness: number): string {
    const h = ((hue % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, saturation)) / 100;
    const l = Math.max(0, Math.min(100, lightness)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    return this.rgbToHex(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    );
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const clamp = (value: number): number => Math.max(0, Math.min(255, value));
    const toHex = (value: number): string => clamp(value).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private shiftLightness(lightness: number, delta: number): number {
    return Math.max(8, Math.min(92, lightness + delta));
  }

  private scheduleAdvance(): void {
    this.clearTimers();

    this.nextTimeoutId = window.setTimeout(() => {
      this.advancePuzzle();
      this.nextTimeoutId = null;
    }, 900);
  }

  private scheduleGameOver(): void {
    this.clearTimers();

    this.nextTimeoutId = window.setTimeout(() => {
      this.finishGame();
      this.nextTimeoutId = null;
    }, 900);
  }

  private clearTimers(): void {
    if (this.nextTimeoutId !== null) {
      window.clearTimeout(this.nextTimeoutId);
      this.nextTimeoutId = null;
    }
  }

  private finishGame(): void {
    this.isComplete.set(true);

    if (this.hasSavedRecord) {
      return;
    }

    const maxScore = this.getMaxScore();
    if (maxScore <= 0) {
      return;
    }

    this.personalRecordsService.saveResult('find-the-error', {
      score: this.score(),
      maxScore: Math.max(1, this.score())
    });
    this.hasSavedRecord = true;
    this.clearProgress();
  }

  private createEnglishRegionNames(): Intl.DisplayNames | null {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      return null;
    }
  }

  private shuffle<T>(values: T[]): T[] {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  private buildProgressSnapshot(): FindErrorProgressSnapshot {
    return {
      version: 1,
      gamePuzzleCodes: this.gamePuzzles().map((puzzle) => puzzle.code),
      puzzleIndex: this.puzzleIndex(),
      score: this.score(),
      isLocked: this.isLocked(),
      errors: this.errors().map((error) => ({
        puzzleCode: error.puzzle.code,
        wrongColor: error.wrongColor,
        correctColor: error.correctColor
      })),
      currentErrorPuzzle: this.currentErrorPuzzle()
        ? {
            puzzleCode: this.currentErrorPuzzle()!.puzzle.code,
            wrongZoneIndex: this.currentErrorPuzzle()!.wrongZoneIndex,
            displayedColors: [...this.currentErrorPuzzle()!.displayedColors],
            wrongColor: this.currentErrorPuzzle()!.wrongColor,
            correctColor: this.currentErrorPuzzle()!.correctColor
          }
        : null
    };
  }

  private restoreProgress(): boolean {
    const snapshot = this.gameProgressService.getPayload<FindErrorProgressSnapshot>(
      FindTheErrorGamePageComponent.PROGRESS_GAME_ID
    );
    if (!snapshot || snapshot.version !== 1 || snapshot.gamePuzzleCodes.length === 0) {
      return false;
    }

    const byCode = new Map(this.allPuzzles.map((puzzle) => [puzzle.code, puzzle]));
    const puzzles = snapshot.gamePuzzleCodes
      .map((code) => byCode.get(code) ?? null)
      .filter((puzzle): puzzle is FlagRebuildPuzzle => !!puzzle);
    if (puzzles.length === 0) {
      return false;
    }

    this.gamePuzzles.set(puzzles);
    this.puzzleIndex.set(Math.max(0, Math.min(snapshot.puzzleIndex, puzzles.length - 1)));
    this.score.set(snapshot.score);
    this.isLocked.set(snapshot.isLocked);
    this.errors.set(
      snapshot.errors
        .map((error) => {
          const puzzle = byCode.get(error.puzzleCode);
          if (!puzzle) {
            return null;
          }

          return {
            puzzle,
            wrongColor: error.wrongColor,
            correctColor: error.correctColor
          };
        })
        .filter((error): error is GameError => !!error)
    );
    this.isComplete.set(false);
    this.hasSavedRecord = false;

    if (snapshot.currentErrorPuzzle) {
      const puzzle = byCode.get(snapshot.currentErrorPuzzle.puzzleCode);
      if (puzzle) {
        this.skipNextPuzzleInitialization = true;
        this.currentErrorPuzzle.set({
          puzzle,
          wrongZoneIndex: snapshot.currentErrorPuzzle.wrongZoneIndex,
          displayedColors: snapshot.currentErrorPuzzle.displayedColors,
          wrongColor: snapshot.currentErrorPuzzle.wrongColor,
          correctColor: snapshot.currentErrorPuzzle.correctColor
        });
      }
    }

    return true;
  }

  private clearProgress(): void {
    this.gameProgressService.clearProgress(FindTheErrorGamePageComponent.PROGRESS_GAME_ID);
  }
}
