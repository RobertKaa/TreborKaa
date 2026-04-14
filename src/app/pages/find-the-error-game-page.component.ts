import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FLAG_REBUILD_PUZZLES } from '../data/flag-rebuild-puzzles';
import { FlagRebuildPattern, FlagRebuildPuzzle } from '../models/flag-rebuild-puzzle';
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

const EXTRA_COLORS = ['#ff7f50', '#2a9d8f', '#8d99ae', '#8338ec', '#f4a261', '#457b9d'];

@Component({
  selector: 'app-find-the-error-game-page',
  imports: [RouterLink],
  templateUrl: './find-the-error-game-page.component.html',
  styleUrl: './find-the-error-game-page.component.css'
})
export class FindTheErrorGamePageComponent implements OnDestroy {
  private readonly personalRecordsService = inject(PersonalRecordsService);
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
    this.startNewGame();

    effect(() => {
      const puzzle = this.currentPuzzle();
      if (!puzzle) {
        return;
      }

      this.isLocked.set(false);
      this.currentErrorPuzzle.set(this.buildErrorPuzzle(puzzle));
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
    this.startNewGame();
  }

  protected getMaxScore(): number {
    return Math.max(1, this.score() + this.errors().length);
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
    const wrongZoneIndex = Math.floor(Math.random() * zoneCount);
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
    const candidates = this.shuffle(
      [...puzzle.palette, ...EXTRA_COLORS].filter(
        (color) => color !== correctColor && !displayedColors.includes(color)
      )
    );

    return candidates[0] ?? correctColor;
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
  }

  private shuffle<T>(values: T[]): T[] {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }
}
