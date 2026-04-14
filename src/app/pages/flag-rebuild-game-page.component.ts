import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import iro from '@jaames/iro';
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

type PuzzleEvaluation = {
  score: number;
  accepted: boolean;
};

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
export class FlagRebuildGamePageComponent implements AfterViewInit, OnDestroy {
  private static readonly VALUE_SLIDER_SIZE = 18;
  private static readonly VALUE_SLIDER_MARGIN = 16;
  private static readonly WHEEL_EXTRA_HEIGHT = 24;
  private readonly personalRecordsService = inject(PersonalRecordsService);
  @ViewChild('iroWheelHost') private iroWheelHost?: ElementRef<HTMLDivElement>;
  protected readonly allPuzzles = FLAG_REBUILD_PUZZLES;
  protected readonly gamePuzzles = signal<FlagRebuildPuzzle[]>([]);
  protected readonly puzzleIndex = signal(0);
  protected readonly score = signal(0);
  protected readonly pieces = signal<PuzzlePiece[]>([]);
  protected readonly selectedPattern = signal<FlagRebuildPattern>('horizontal-stripes');
  protected readonly errors = signal<PuzzleError[]>([]);
  protected readonly isComplete = signal(false);
  protected readonly isLocked = signal(false);
  protected readonly activeZoneIndex = signal(0);
  protected readonly isColorPickerOpen = signal(false);
  private readonly patternOptionsByPuzzle = signal<Record<string, FlagRebuildPattern[]>>({});
  private colorWheelPicker: ReturnType<typeof iro.ColorPicker> | null = null;
  private colorChangeHandler: ((color: { hexString: string }) => void) | null = null;
  private wheelSyncFrameId: number | null = null;
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
  protected readonly displayedPatternOptions = computed(() => {
    const puzzle = this.currentPuzzle();
    if (!puzzle) {
      return [];
    }

    return this.patternOptionsByPuzzle()[puzzle.code] ?? [puzzle.targetPattern];
  });
  protected readonly activePiece = computed(() => this.pieces()[this.activeZoneIndex()] ?? null);
  protected readonly activeZoneLabel = computed(() => this.getZoneLabel(this.activeZoneIndex()));

  constructor() {
    this.startNewGame();

    effect(() => {
      const puzzle = this.currentPuzzle();
      if (!puzzle) {
        return;
      }

      const code = puzzle.code;
      const patternOptions =
        untracked(() => this.patternOptionsByPuzzle()[code]) ?? this.buildPatternOptions(puzzle);
      this.patternOptionsByPuzzle.update((options) => ({
        ...options,
        [code]: patternOptions
      }));
      this.destroyColorWheelPicker();
      this.isLocked.set(false);
      this.selectedPattern.set(patternOptions[0] ?? puzzle.targetPattern);
      this.activeZoneIndex.set(0);
      this.isColorPickerOpen.set(false);
      this.pieces.set(this.buildInitialPieces(puzzle));
    });
  }

  ngAfterViewInit(): void {
    if (this.isColorPickerOpen()) {
      this.scheduleColorWheelSync();
    }
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

  protected isBlankColor(color: string | undefined): boolean {
    return color?.toLowerCase() === '#ffffff';
  }

  protected selectPattern(pattern: FlagRebuildPattern): void {
    if (this.isLocked()) {
      return;
    }

    this.selectedPattern.set(pattern);
  }

  protected openColorPicker(index: number): void {
    if (this.isLocked()) {
      return;
    }

    this.activeZoneIndex.set(index);
    this.isColorPickerOpen.set(true);
    this.scheduleColorWheelSync();
  }

  protected closeColorPicker(): void {
    this.isColorPickerOpen.set(false);
    this.destroyColorWheelPicker();
  }

  protected selectPresetColor(color: '#000000' | '#ffffff'): void {
    const piece = this.activePiece();
    if (!piece || this.isLocked()) {
      return;
    }

    this.updatePieceColor(piece.id, color);
    if (this.colorWheelPicker) {
      this.colorWheelPicker.color.hexString = color;
    }
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
    const evaluation = this.evaluatePuzzle(
      puzzle.targetPattern,
      this.selectedPattern(),
      puzzle.targetColors,
      this.previewColors()
    );

    if (!evaluation.accepted) {
      this.errors.update((errors) => [...errors, { puzzle, score: evaluation.score }]);
      this.scheduleGameOver();
      return;
    }

    this.score.update((score) => score + 1);
    this.scheduleAdvance();
  }

  protected restartGame(): void {
    this.clearTimers();
    this.destroyColorWheelPicker();
    this.startNewGame();
  }

  protected getMaxScore(): number {
    return Math.max(1, this.score() + this.errors().length);
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.destroyColorWheelPicker();
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

  private buildInitialPieces(puzzle: FlagRebuildPuzzle): PuzzlePiece[] {
    return puzzle.targetColors.map((_, index) => ({
      id: `${puzzle.code}-${index}`,
      color: '#ffffff'
    }));
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
    this.patternOptionsByPuzzle.set({});
    this.destroyColorWheelPicker();
    this.hasSavedRecord = false;
  }

  private evaluatePuzzle(
    targetPattern: FlagRebuildPattern,
    selectedPattern: FlagRebuildPattern,
    targetColors: string[],
    userColors: string[]
  ): PuzzleEvaluation {
    const patternMatch = selectedPattern === targetPattern;
    const similarities = targetColors.map((targetColor, index) =>
      this.computeColorSimilarity((userColors[index] ?? '#ffffff').toLowerCase(), targetColor.toLowerCase())
    );
    const averageSimilarity =
      similarities.reduce((sum, value) => sum + value, 0) / Math.max(1, similarities.length);
    const minimumSimilarity = Math.min(...similarities, 1);
    const score = Math.round((patternMatch ? 30 : 0) + averageSimilarity * 70);
    const accepted = patternMatch && averageSimilarity >= 0.78 && minimumSimilarity >= 0.46;

    return { score: Math.min(score, 100), accepted };
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
    if (this.wheelSyncFrameId !== null) {
      window.cancelAnimationFrame(this.wheelSyncFrameId);
      this.wheelSyncFrameId = null;
    }

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

  private scheduleColorWheelSync(): void {
    if (!this.isColorPickerOpen()) {
      return;
    }

    if (this.wheelSyncFrameId !== null) {
      window.cancelAnimationFrame(this.wheelSyncFrameId);
    }

    this.wheelSyncFrameId = window.requestAnimationFrame(() => {
      this.mountOrSyncColorWheelPicker();
      this.wheelSyncFrameId = null;
    });
  }

  private mountOrSyncColorWheelPicker(): void {
    const host = this.iroWheelHost?.nativeElement;
    const activePiece = this.activePiece();

    if (!host || !activePiece || !this.isColorPickerOpen()) {
      return;
    }

    const wheelSize = this.getWheelSize(host);
    host.style.width = `${wheelSize}px`;
    host.style.height = `${this.getWheelHostHeight(wheelSize)}px`;

    if (!this.colorWheelPicker) {
      host.innerHTML = '';
      this.colorWheelPicker = iro.ColorPicker(host, {
        width: wheelSize,
        color: activePiece.color,
        padding: 0,
        borderWidth: 1,
        handleRadius: 8,
        activeHandleRadius: 10,
        wheelLightness: false,
        sliderSize: FlagRebuildGamePageComponent.VALUE_SLIDER_SIZE,
        sliderMargin: FlagRebuildGamePageComponent.VALUE_SLIDER_MARGIN,
        layout: [
          {
            component: iro.ui.Wheel
          },
          {
            component: iro.ui.Slider,
            options: {
              sliderType: 'value',
              sliderShape: 'bar'
            }
          }
        ]
      });

      this.colorChangeHandler = (color: { hexString: string }) => {
        const piece = this.activePiece();
        if (!piece || this.isLocked()) {
          return;
        }

        this.updatePieceColor(piece.id, color.hexString.toLowerCase());
      };

      this.colorWheelPicker.on('color:change', this.colorChangeHandler);
      return;
    }

    this.colorWheelPicker.color.hexString = activePiece.color;
    this.colorWheelPicker.resize(wheelSize);
  }

  private destroyColorWheelPicker(): void {
    if (this.wheelSyncFrameId !== null) {
      window.cancelAnimationFrame(this.wheelSyncFrameId);
      this.wheelSyncFrameId = null;
    }

    if (this.colorWheelPicker && this.colorChangeHandler) {
      this.colorWheelPicker.off('color:change', this.colorChangeHandler);
    }

    this.colorChangeHandler = null;
    this.colorWheelPicker = null;
  }

  private getWheelSize(host: HTMLElement): number {
    const width = host.clientWidth || host.getBoundingClientRect().width || 280;
    return Math.round(Math.max(240, Math.min(320, width)));
  }

  private getWheelHostHeight(wheelSize: number): number {
    return (
      wheelSize +
      FlagRebuildGamePageComponent.VALUE_SLIDER_SIZE +
      FlagRebuildGamePageComponent.VALUE_SLIDER_MARGIN +
      FlagRebuildGamePageComponent.WHEEL_EXTRA_HEIGHT
    );
  }

  private computeColorSimilarity(left: string, right: string): number {
    const distance = this.computePerceptualDistance(left, right);

    if (distance <= 6) {
      return 1;
    }

    if (distance <= 12) {
      return 0.92;
    }

    if (distance <= 18) {
      return 0.84;
    }

    if (distance <= 24) {
      return 0.8;
    }

    if (distance <= 32) {
      return 0.7;
    }

    if (distance <= 40) {
      return 0.58;
    }

    if (distance <= 52) {
      return 0.44;
    }

    return 0.22;
  }

  private computePerceptualDistance(left: string, right: string): number {
    const a = this.hexToRgb(left);
    const b = this.hexToRgb(right);

    if (!a || !b) {
      return Number.MAX_SAFE_INTEGER;
    }

    const labA = this.rgbToLab(a);
    const labB = this.rgbToLab(b);
    const dL = labA.l - labB.l;
    const dA = labA.a - labB.a;
    const dB = labA.b - labB.b;
    return Math.sqrt(dL * dL + dA * dA + dB * dB);
  }

  private rgbToLab(color: { r: number; g: number; b: number }): { l: number; a: number; b: number } {
    const r = this.pivotRgb(color.r / 255);
    const g = this.pivotRgb(color.g / 255);
    const b = this.pivotRgb(color.b / 255);

    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    const fx = this.pivotLab(x);
    const fy = this.pivotLab(y);
    const fz = this.pivotLab(z);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  private pivotRgb(value: number): number {
    if (value <= 0.04045) {
      return value / 12.92;
    }

    return ((value + 0.055) / 1.055) ** 2.4;
  }

  private pivotLab(value: number): number {
    if (value > 0.008856) {
      return value ** (1 / 3);
    }

    return 7.787 * value + 16 / 116;
  }

  private hexToRgb(color: string): { r: number; g: number; b: number } | null {
    const normalized = color.replace('#', '');
    if (normalized.length !== 6) {
      return null;
    }

    const value = Number.parseInt(normalized, 16);
    if (Number.isNaN(value)) {
      return null;
    }

    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }
}
