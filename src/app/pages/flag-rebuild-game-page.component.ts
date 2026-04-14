import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FLAG_REBUILD_PUZZLES } from '../data/flag-rebuild-puzzles';
import { FlagRebuildPattern, FlagRebuildPuzzle } from '../models/flag-rebuild-puzzle';
import { PersonalRecordsService } from '../services/personal-records.service';

type PuzzlePiece = {
  id: string;
  color: string;
};

type PuzzleError = {
  puzzle: FlagRebuildPuzzle;
  score: number;
};

const EXTRA_COLORS = [
  '#6c757d',
  '#8d99ae',
  '#ff7f50',
  '#2a9d8f',
  '#8338ec',
  '#f4a261',
  '#457b9d',
  '#e9c46a'
];

const ALL_PATTERNS: FlagRebuildPattern[] = [
  'horizontal-stripes',
  'vertical-stripes',
  'triangle-left-bands-2',
  'triangle-left-bands-3',
  'left-band-horizontal',
  'nordic-cross'
];

const PATTERN_LABELS: Record<FlagRebuildPattern, string> = {
  'horizontal-stripes': 'Bandes horizontales',
  'vertical-stripes': 'Bandes verticales',
  'triangle-left-bands-2': 'Triangle + 2 bandes',
  'triangle-left-bands-3': 'Triangle + 3 bandes',
  'left-band-horizontal': 'Bande gauche + bandes',
  'nordic-cross': 'Croix nordique'
};

@Component({
  selector: 'app-flag-rebuild-game-page',
  imports: [RouterLink],
  templateUrl: './flag-rebuild-game-page.component.html',
  styleUrl: './flag-rebuild-game-page.component.css'
})
export class FlagRebuildGamePageComponent implements OnDestroy {
  private readonly personalRecordsService = inject(PersonalRecordsService);
  protected readonly allPuzzles = FLAG_REBUILD_PUZZLES;
  protected readonly gamePuzzles = signal<FlagRebuildPuzzle[]>([]);
  protected readonly puzzleIndex = signal(0);
  protected readonly score = signal(0);
  protected readonly pieces = signal<PuzzlePiece[]>([]);
  protected readonly selectedPattern = signal<FlagRebuildPattern>('horizontal-stripes');
  protected readonly errors = signal<PuzzleError[]>([]);
  protected readonly isComplete = signal(false);
  protected readonly isLocked = signal(false);
  private readonly paletteByPuzzle = signal<Record<string, string[]>>({});
  private readonly pieceOptionsByPuzzle = signal<Record<string, Record<string, string[]>>>({});
  private readonly patternOptionsByPuzzle = signal<Record<string, FlagRebuildPattern[]>>({});
  private nextTimeoutId: number | null = null;
  private hasSavedRecord = false;

  protected readonly totalPuzzles = computed(() => this.gamePuzzles().length);
  protected readonly currentPuzzle = computed(() => this.gamePuzzles()[this.puzzleIndex()] ?? null);
  protected readonly progressLabel = computed(() => `${this.score() + 1}`);
  protected readonly progressPercent = computed(() => {
    return 100;
  });
  protected readonly previewColors = computed(() => this.pieces().map((piece) => piece.color));
  protected readonly previewColorsForPattern = computed(() => {
    const puzzle = this.currentPuzzle();
    if (!puzzle) {
      return [];
    }

    return this.getPatternPreviewColors(
      this.selectedPattern(),
      this.previewColors(),
      puzzle.targetColors.length
    );
  });
  protected readonly displayedPalette = computed(() => {
    const puzzle = this.currentPuzzle();
    if (!puzzle) {
      return [];
    }

    return this.paletteByPuzzle()[puzzle.code] ?? puzzle.palette;
  });
  protected readonly displayedPatternOptions = computed(() => {
    const puzzle = this.currentPuzzle();
    if (!puzzle) {
      return [];
    }

    return this.patternOptionsByPuzzle()[puzzle.code] ?? [puzzle.targetPattern];
  });

  constructor() {
    this.startNewGame();

    effect(() => {
      const puzzle = this.currentPuzzle();
      if (!puzzle) {
        return;
      }

      const code = puzzle.code;
      const palette =
        untracked(() => this.paletteByPuzzle()[code]) ?? this.shuffle([...puzzle.palette]);
      const patternOptions =
        untracked(() => this.patternOptionsByPuzzle()[code]) ?? this.buildPatternOptions(puzzle);
      const pieceOptions =
        untracked(() => this.pieceOptionsByPuzzle()[code]) ?? this.buildPieceOptions(puzzle, palette);

      this.paletteByPuzzle.update((palettes) => ({
        ...palettes,
        [code]: palette
      }));
      this.patternOptionsByPuzzle.update((options) => ({
        ...options,
        [code]: patternOptions
      }));
      this.pieceOptionsByPuzzle.update((options) => ({
        ...options,
        [code]: pieceOptions
      }));
      this.isLocked.set(false);
      this.selectedPattern.set(patternOptions[0] ?? puzzle.targetPattern);
      this.pieces.set(this.buildInitialPieces(puzzle, palette));
    });
  }

  protected getPatternLabel(pattern: FlagRebuildPattern): string {
    return PATTERN_LABELS[pattern];
  }

  protected getZoneLabel(index: number): string {
    switch (this.selectedPattern()) {
      case 'vertical-stripes':
        return ['Gauche', 'Centre', 'Droite'][index] ?? `Zone ${index + 1}`;
      case 'horizontal-stripes':
        return ['Haut', 'Milieu', 'Bas'][index] ?? `Zone ${index + 1}`;
      case 'triangle-left-bands-2':
        return ['Triangle', 'Haut droite', 'Bas droite'][index] ?? `Zone ${index + 1}`;
      case 'triangle-left-bands-3':
        return ['Triangle', 'Haut droite', 'Milieu droite', 'Bas droite'][index] ?? `Zone ${index + 1}`;
      case 'left-band-horizontal':
        return ['Bande gauche', 'Haut droite', 'Milieu droite', 'Bas droite'][index] ?? `Zone ${index + 1}`;
      case 'nordic-cross':
        return ['Fond', 'Croix'][index] ?? `Zone ${index + 1}`;
      default:
        return `Zone ${index + 1}`;
    }
  }

  protected getColorOptions(pieceId: string): string[] {
    const puzzle = this.currentPuzzle();
    if (!puzzle) {
      return [];
    }

    return this.pieceOptionsByPuzzle()[puzzle.code]?.[pieceId] ?? this.displayedPalette();
  }

  protected isBlankColor(color: string | undefined): boolean {
    return color?.toLowerCase() === '#ffffff';
  }

  protected selectPattern(pattern: FlagRebuildPattern): void {
    if (this.isLocked()) {
      return;
    }

    this.selectedPattern.set(pattern);
  }

  protected updatePieceColor(pieceId: string, color: string): void {
    if (this.isLocked()) {
      return;
    }

    this.pieces.update((pieces) =>
      pieces.map((piece) => (piece.id === pieceId ? { ...piece, color } : piece))
    );
  }

  protected submitPuzzle(): void {
    const puzzle = this.currentPuzzle();
    if (!puzzle || this.isLocked()) {
      return;
    }

    this.isLocked.set(true);
    const puzzleScore = this.computePuzzleScore(
      puzzle.targetPattern,
      this.selectedPattern(),
      puzzle.targetColors,
      this.previewColors()
    );

    if (puzzleScore < 100) {
      this.errors.update((errors) => [...errors, { puzzle, score: puzzleScore }]);
      this.scheduleGameOver();
      return;
    }

    this.score.update((score) => score + 1);
    this.scheduleAdvance();
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

  private buildInitialPieces(puzzle: FlagRebuildPuzzle, _displayPalette: string[]): PuzzlePiece[] {
    return puzzle.targetColors.map((_, index) => ({
      id: `${puzzle.code}-${index}`,
      color: '#ffffff'
    }));
  }

  private buildPieceOptions(
    puzzle: FlagRebuildPuzzle,
    displayPalette: string[]
  ): Record<string, string[]> {
    const paletteSource = this.shuffle([...puzzle.palette, ...EXTRA_COLORS]);
    const options: Record<string, string[]> = {};

    for (let index = 0; index < puzzle.targetColors.length; index += 1) {
      const pieceId = `${puzzle.code}-${index}`;
      const correct = puzzle.targetColors[index];
      const distractors = this.shuffle(
        paletteSource.filter((color) => color !== correct && !displayPalette.includes(color))
      ).slice(0, 3);

      options[pieceId] = this.shuffle([correct, ...distractors]);
    }

    return options;
  }

  private buildPatternOptions(puzzle: FlagRebuildPuzzle): FlagRebuildPattern[] {
    const colorCount = puzzle.targetColors.length;
    const matchingPatterns = ALL_PATTERNS.filter((pattern) =>
      this.supportsColorCount(pattern, colorCount)
    );
    const withTarget = matchingPatterns.includes(puzzle.targetPattern)
      ? matchingPatterns
      : [...matchingPatterns, puzzle.targetPattern];

    return this.shuffle(withTarget);
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
      case 'triangle-left-bands-2':
        return 3;
      case 'triangle-left-bands-3':
        return 4;
      case 'left-band-horizontal':
        return Math.max(3, colorCount);
      case 'nordic-cross':
        return 2;
      default:
        return Math.max(2, colorCount);
    }
  }

  private supportsColorCount(pattern: FlagRebuildPattern, colorCount: number): boolean {
    switch (pattern) {
      case 'nordic-cross':
        return colorCount === 2;
      case 'triangle-left-bands-2':
        return colorCount === 3;
      case 'triangle-left-bands-3':
        return colorCount === 4;
      case 'left-band-horizontal':
        return colorCount >= 3;
      default:
        return colorCount >= 2;
    }
  }

  private startNewGame(): void {
    const selectedPuzzles = this.shuffle([...this.allPuzzles]);

    this.gamePuzzles.set(selectedPuzzles);
    this.puzzleIndex.set(0);
    this.score.set(0);
    this.errors.set([]);
    this.isComplete.set(false);
    this.isLocked.set(false);
    this.paletteByPuzzle.set({});
    this.pieceOptionsByPuzzle.set({});
    this.patternOptionsByPuzzle.set({});
    this.hasSavedRecord = false;
  }

  private computePuzzleScore(
    targetPattern: FlagRebuildPattern,
    selectedPattern: FlagRebuildPattern,
    targetColors: string[],
    userColors: string[]
  ): number {
    let score = selectedPattern === targetPattern ? 30 : 0;
    const colorBudget = 70;
    const step = colorBudget / targetColors.length;

    for (let index = 0; index < targetColors.length; index += 1) {
      if (userColors[index] === targetColors[index]) {
        score += step;
      } else if (targetColors.includes(userColors[index])) {
        score += step * 0.35;
      }
    }

    return Math.round(Math.min(score, 100));
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

    this.personalRecordsService.saveResult('flag-rebuild', {
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
