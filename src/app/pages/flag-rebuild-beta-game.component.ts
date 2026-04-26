import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FLAG_REBUILD_PUZZLES } from '../data/flag-rebuild-puzzles';
import { FlagRebuildPattern, FlagRebuildPuzzle } from '../models/flag-rebuild-puzzle';
import { I18nService } from '../services/i18n.service';

type BetaPiece = {
  id: string;
  color: string;
};

type BetaResult = {
  score: number;
  colorScore: number;
  imageScore: number | null;
  patternScore: number;
  zoneScores: number[];
  labelKey: string;
};

type PatternChoice = {
  pattern: FlagRebuildPattern;
};

const FLAG_CANVAS_WIDTH = 360;
const FLAG_CANVAS_HEIGHT = 240;

@Component({
  selector: 'app-flag-rebuild-beta-game',
  templateUrl: './flag-rebuild-beta-game.component.html',
  styleUrl: './flag-rebuild-beta-game.component.css',
})
export class FlagRebuildBetaGameComponent implements AfterViewInit {
  protected readonly i18n = inject(I18nService);
  private readonly englishRegionNames = this.createEnglishRegionNames();
  private readonly allPuzzles = FLAG_REBUILD_PUZZLES;
  @ViewChild('playerCanvas') private playerCanvas?: ElementRef<HTMLCanvasElement>;
  protected readonly currentPuzzle = signal<FlagRebuildPuzzle>(this.pickPuzzle());
  protected readonly selectedPattern = signal<FlagRebuildPattern>(
    this.pickInitialPattern(this.currentPuzzle()),
  );
  protected readonly selectedZoneIndex = signal(0);
  protected readonly pieces = signal<BetaPiece[]>(
    this.fitPiecesToPattern(
      this.selectedPattern(),
      this.buildInitialPieces(this.currentPuzzle()),
      this.currentPuzzle(),
    ),
  );
  protected readonly result = signal<BetaResult | null>(null);
  protected readonly round = signal(1);
  protected readonly totalScore = signal(0);
  protected readonly isScoring = signal(false);
  private readonly realFlagCache = new Map<string, ImageData | null>();

  protected readonly activePiece = computed(() => this.pieces()[this.selectedZoneIndex()] ?? null);
  protected readonly previewColors = computed(() => this.pieces().map((piece) => piece.color));
  protected readonly previewColorsForPattern = computed(() => {
    const puzzle = this.currentPuzzle();
    return this.getPatternPreviewColors(
      this.selectedPattern(),
      this.previewColors(),
      puzzle.targetColors.length,
    );
  });
  protected readonly paletteOptions = computed(() =>
    this.buildPaletteOptions(this.currentPuzzle()),
  );
  protected readonly patternChoices = computed(() =>
    this.buildPatternChoices(this.currentPuzzle()),
  );
  protected readonly masteryPercent = computed(() =>
    Math.min(100, Math.round((this.totalScore() / Math.max(1, this.round() * 100)) * 100)),
  );

  constructor() {
    effect(() => {
      this.selectedPattern();
      this.previewColorsForPattern();
      this.selectedZoneIndex();
      this.renderPlayerCanvas();
    });
  }

  ngAfterViewInit(): void {
    this.renderPlayerCanvas();
  }

  protected countryName(puzzle: FlagRebuildPuzzle): string {
    if (this.i18n.isFrench()) {
      return puzzle.nameFrench;
    }

    return this.englishRegionNames?.of(puzzle.code.toUpperCase()) ?? puzzle.nameFrench;
  }

  protected getPatternLabel(pattern: FlagRebuildPattern): string {
    return this.i18n.t(`rebuild.pattern.${pattern}`);
  }

  protected getZoneLabel(index: number): string {
    switch (this.selectedPattern()) {
      case 'vertical-stripes':
        return (
          [
            this.i18n.t('rebuild.zone.left'),
            this.i18n.t('rebuild.zone.center'),
            this.i18n.t('rebuild.zone.right'),
          ][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'horizontal-stripes':
        return (
          [
            this.i18n.t('rebuild.zone.top'),
            this.i18n.t('rebuild.zone.middle'),
            this.i18n.t('rebuild.zone.bottom'),
          ][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'triangle-left-bands-2':
        return (
          [
            this.i18n.t('rebuild.zone.triangle'),
            this.i18n.t('rebuild.zone.topRight'),
            this.i18n.t('rebuild.zone.bottomRight'),
          ][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'triangle-left-bands-3':
        return (
          [
            this.i18n.t('rebuild.zone.triangle'),
            this.i18n.t('rebuild.zone.topRight'),
            this.i18n.t('rebuild.zone.middleRight'),
            this.i18n.t('rebuild.zone.bottomRight'),
          ][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'left-band-horizontal':
        return (
          [
            this.i18n.t('rebuild.zone.leftBand'),
            this.i18n.t('rebuild.zone.topRight'),
            this.i18n.t('rebuild.zone.middleRight'),
            this.i18n.t('rebuild.zone.bottomRight'),
          ][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'nordic-cross':
        return (
          [this.i18n.t('rebuild.zone.background'), this.i18n.t('rebuild.zone.cross')][index] ??
          this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      default:
        return this.i18n.t('rebuild.zone.generic', { index: index + 1 });
    }
  }

  protected isBlankColor(color: string | undefined): boolean {
    return color?.toLowerCase() === '#f7f3ea' || color?.toLowerCase() === '#ffffff';
  }

  protected selectPattern(pattern: FlagRebuildPattern): void {
    this.selectedPattern.set(pattern);
    this.selectedZoneIndex.set(0);
    this.result.set(null);
    this.pieces.set(this.fitPiecesToPattern(pattern, this.pieces(), this.currentPuzzle()));
  }

  protected selectZone(index: number): void {
    this.selectedZoneIndex.set(index);
    this.result.set(null);
  }

  protected selectColor(color: string): void {
    const activePiece = this.activePiece();
    if (!activePiece) {
      return;
    }

    this.result.set(null);
    this.pieces.update((pieces) =>
      pieces.map((piece) => (piece.id === activePiece.id ? { ...piece, color } : piece)),
    );
  }

  protected async submitRound(): Promise<void> {
    if (this.isScoring()) {
      return;
    }

    this.isScoring.set(true);
    const result = await this.evaluatePuzzle(
      this.currentPuzzle(),
      this.selectedPattern(),
      this.previewColors(),
    );

    this.result.set(result);
    this.totalScore.update((score) => score + result.score);
    this.isScoring.set(false);
  }

  protected retryRound(): void {
    this.result.set(null);
  }

  protected nextRound(): void {
    const nextPuzzle = this.pickPuzzle(this.currentPuzzle().code);
    this.currentPuzzle.set(nextPuzzle);
    const nextPattern = this.pickInitialPattern(nextPuzzle);
    this.selectedPattern.set(nextPattern);
    this.pieces.set(
      this.fitPiecesToPattern(nextPattern, this.buildInitialPieces(nextPuzzle), nextPuzzle),
    );
    this.selectedZoneIndex.set(0);
    this.result.set(null);
    this.round.update((round) => round + 1);
  }

  protected selectZoneFromCanvas(event: MouseEvent): void {
    const canvas = this.playerCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
    this.selectZone(
      this.findZoneAtPoint(this.selectedPattern(), x, y, this.previewColorsForPattern().length),
    );
  }

  private async evaluatePuzzle(
    puzzle: FlagRebuildPuzzle,
    selectedPattern: FlagRebuildPattern,
    userColors: string[],
    useRealImage = true,
  ): Promise<BetaResult> {
    const zoneScores = puzzle.targetColors.map((targetColor, index) =>
      Math.round(this.computeColorProximity(userColors[index] ?? '#ffffff', targetColor) * 100),
    );
    const colorScore = Math.round(
      zoneScores.reduce((sum, score) => sum + score, 0) / Math.max(1, zoneScores.length),
    );
    const patternScore = selectedPattern === puzzle.targetPattern ? 100 : 58;
    const imageScore = useRealImage
      ? await this.computeRealFlagImageScore(puzzle, selectedPattern, userColors)
      : null;
    const visualScore = imageScore ?? colorScore;
    const score = Math.round(visualScore * (patternScore / 100));

    return {
      score,
      colorScore,
      imageScore,
      patternScore,
      zoneScores,
      labelKey: this.getResultLabelKey(score),
    };
  }

  private getResultLabelKey(score: number): string {
    if (score >= 92) {
      return 'classic.rebuild.beta.rank.perfect';
    }

    if (score >= 76) {
      return 'classic.rebuild.beta.rank.close';
    }

    if (score >= 55) {
      return 'classic.rebuild.beta.rank.warm';
    }

    return 'classic.rebuild.beta.rank.cold';
  }

  private buildInitialPieces(puzzle: FlagRebuildPuzzle): BetaPiece[] {
    return puzzle.targetColors.map((_, index) => ({
      id: `${puzzle.code}-beta-${index}`,
      color: '#f7f3ea',
    }));
  }

  private fitPiecesToPattern(
    pattern: FlagRebuildPattern,
    pieces: BetaPiece[],
    puzzle: FlagRebuildPuzzle,
  ): BetaPiece[] {
    const zoneCount = this.getPatternZoneCount(pattern, puzzle.targetColors.length);

    return Array.from({ length: zoneCount }, (_, index) => {
      return (
        pieces[index] ?? {
          id: `${puzzle.code}-beta-${index}`,
          color: '#f7f3ea',
        }
      );
    });
  }

  private buildPaletteOptions(puzzle: FlagRebuildPuzzle): string[] {
    return Array.from(new Set([...puzzle.palette, '#111111', '#ffffff', '#f7f3ea']));
  }

  private buildPatternChoices(puzzle: FlagRebuildPuzzle): PatternChoice[] {
    return puzzle.patternOptions.map((pattern) => ({
      pattern,
    }));
  }

  private pickInitialPattern(puzzle: FlagRebuildPuzzle): FlagRebuildPattern {
    return this.shuffle([...puzzle.patternOptions])[0] ?? puzzle.targetPattern;
  }

  private getPatternPreviewColors(
    pattern: FlagRebuildPattern,
    sourceColors: string[],
    colorCount: number,
  ): string[] {
    const zoneCount = this.getPatternZoneCount(pattern, colorCount);

    return Array.from({ length: zoneCount }, (_, index) => sourceColors[index] ?? '#f7f3ea');
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

  private renderPlayerCanvas(): void {
    const canvas = this.playerCanvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    canvas.width = FLAG_CANVAS_WIDTH;
    canvas.height = FLAG_CANVAS_HEIGHT;
    this.drawPattern(
      context,
      this.selectedPattern(),
      this.previewColorsForPattern(),
      FLAG_CANVAS_WIDTH,
      FLAG_CANVAS_HEIGHT,
    );
    this.drawSelectedZone(
      context,
      this.selectedPattern(),
      this.selectedZoneIndex(),
      this.previewColorsForPattern().length,
      FLAG_CANVAS_WIDTH,
      FLAG_CANVAS_HEIGHT,
    );
  }

  private async computeRealFlagImageScore(
    puzzle: FlagRebuildPuzzle,
    selectedPattern: FlagRebuildPattern,
    userColors: string[],
  ): Promise<number | null> {
    const reference = await this.loadRealFlagImageData(puzzle.flagUrl);
    const userImage = this.renderPatternImageData(selectedPattern, userColors);

    if (!reference || !userImage) {
      return null;
    }

    let totalProximity = 0;
    let sampledPixels = 0;

    for (let index = 0; index < reference.data.length; index += 16) {
      const alpha = reference.data[index + 3];
      if (alpha < 16) {
        continue;
      }

      const distance = this.rgbDistance(
        reference.data[index],
        reference.data[index + 1],
        reference.data[index + 2],
        userImage.data[index],
        userImage.data[index + 1],
        userImage.data[index + 2],
      );
      totalProximity += Math.max(0, 1 - distance / 255);
      sampledPixels += 1;
    }

    return Math.round((totalProximity / Math.max(1, sampledPixels)) * 100);
  }

  private renderPatternImageData(pattern: FlagRebuildPattern, colors: string[]): ImageData | null {
    const canvas = document.createElement('canvas');
    canvas.width = FLAG_CANVAS_WIDTH;
    canvas.height = FLAG_CANVAS_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    this.drawPattern(
      context,
      pattern,
      this.getPatternPreviewColors(pattern, colors, colors.length),
      FLAG_CANVAS_WIDTH,
      FLAG_CANVAS_HEIGHT,
    );
    return context.getImageData(0, 0, FLAG_CANVAS_WIDTH, FLAG_CANVAS_HEIGHT);
  }

  private async loadRealFlagImageData(flagUrl: string): Promise<ImageData | null> {
    if (this.realFlagCache.has(flagUrl)) {
      return this.realFlagCache.get(flagUrl) ?? null;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    const imageData = await new Promise<ImageData | null>((resolve) => {
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = FLAG_CANVAS_WIDTH;
        canvas.height = FLAG_CANVAS_HEIGHT;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, FLAG_CANVAS_WIDTH, FLAG_CANVAS_HEIGHT);
        context.drawImage(image, 0, 0, FLAG_CANVAS_WIDTH, FLAG_CANVAS_HEIGHT);
        resolve(context.getImageData(0, 0, FLAG_CANVAS_WIDTH, FLAG_CANVAS_HEIGHT));
      };
      image.onerror = () => resolve(null);
      image.src = flagUrl;
    });

    this.realFlagCache.set(flagUrl, imageData);
    return imageData;
  }

  private drawPattern(
    context: CanvasRenderingContext2D,
    pattern: FlagRebuildPattern,
    colors: string[],
    width: number,
    height: number,
  ): void {
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f7f3ea';
    context.fillRect(0, 0, width, height);

    switch (pattern) {
      case 'vertical-stripes':
        colors.forEach((color, index) => {
          context.fillStyle = color;
          context.fillRect((index * width) / colors.length, 0, width / colors.length, height);
        });
        break;
      case 'horizontal-stripes':
        colors.forEach((color, index) => {
          context.fillStyle = color;
          context.fillRect(0, (index * height) / colors.length, width, height / colors.length);
        });
        break;
      case 'triangle-left-bands-2':
      case 'triangle-left-bands-3':
        colors.slice(1).forEach((color, index, stripes) => {
          context.fillStyle = color;
          context.fillRect(0, (index * height) / stripes.length, width, height / stripes.length);
        });
        context.fillStyle = colors[0] ?? '#f7f3ea';
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(width * 0.48, height * 0.5);
        context.lineTo(0, height);
        context.closePath();
        context.fill();
        break;
      case 'left-band-horizontal':
        context.fillStyle = colors[0] ?? '#f7f3ea';
        context.fillRect(0, 0, width * 0.28, height);
        colors.slice(1).forEach((color, index, stripes) => {
          context.fillStyle = color;
          context.fillRect(
            width * 0.28,
            (index * height) / stripes.length,
            width * 0.72,
            height / stripes.length,
          );
        });
        break;
      case 'nordic-cross':
        context.fillStyle = colors[0] ?? '#f7f3ea';
        context.fillRect(0, 0, width, height);
        context.fillStyle = colors[1] ?? '#f7f3ea';
        context.fillRect(width * 0.3, 0, width * 0.16, height);
        context.fillRect(0, height * 0.415, width, height * 0.17);
        break;
    }
  }

  private drawSelectedZone(
    context: CanvasRenderingContext2D,
    pattern: FlagRebuildPattern,
    zoneIndex: number,
    zoneCount: number,
    width: number,
    height: number,
  ): void {
    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    context.lineWidth = 5;
    context.shadowColor = 'rgba(12, 127, 111, 0.5)';
    context.shadowBlur = 12;

    switch (pattern) {
      case 'vertical-stripes':
        context.strokeRect(
          (zoneIndex * width) / zoneCount + 3,
          3,
          width / zoneCount - 6,
          height - 6,
        );
        break;
      case 'horizontal-stripes':
        context.strokeRect(
          3,
          (zoneIndex * height) / zoneCount + 3,
          width - 6,
          height / zoneCount - 6,
        );
        break;
      case 'triangle-left-bands-2':
      case 'triangle-left-bands-3':
        if (zoneIndex === 0) {
          context.beginPath();
          context.moveTo(4, 4);
          context.lineTo(width * 0.48 - 4, height * 0.5);
          context.lineTo(4, height - 4);
          context.closePath();
          context.stroke();
        } else {
          const stripes = zoneCount - 1;
          context.strokeRect(
            3,
            ((zoneIndex - 1) * height) / stripes + 3,
            width - 6,
            height / stripes - 6,
          );
        }
        break;
      case 'left-band-horizontal':
        if (zoneIndex === 0) {
          context.strokeRect(3, 3, width * 0.28 - 6, height - 6);
        } else {
          const stripes = zoneCount - 1;
          context.strokeRect(
            width * 0.28 + 3,
            ((zoneIndex - 1) * height) / stripes + 3,
            width * 0.72 - 6,
            height / stripes - 6,
          );
        }
        break;
      case 'nordic-cross':
        if (zoneIndex === 1) {
          context.strokeRect(width * 0.3 + 3, 3, width * 0.16 - 6, height - 6);
          context.strokeRect(3, height * 0.415 + 3, width - 6, height * 0.17 - 6);
        } else {
          context.strokeRect(3, 3, width - 6, height - 6);
        }
        break;
    }

    context.restore();
  }

  private findZoneAtPoint(
    pattern: FlagRebuildPattern,
    x: number,
    y: number,
    zoneCount: number,
  ): number {
    switch (pattern) {
      case 'vertical-stripes':
        return Math.min(zoneCount - 1, Math.floor(x * zoneCount));
      case 'horizontal-stripes':
        return Math.min(zoneCount - 1, Math.floor(y * zoneCount));
      case 'triangle-left-bands-2':
      case 'triangle-left-bands-3': {
        const triangleEdgeX = 0.48 * (1 - Math.abs(y * 2 - 1));
        if (x <= triangleEdgeX) {
          return 0;
        }

        return 1 + Math.min(zoneCount - 2, Math.floor(y * (zoneCount - 1)));
      }
      case 'left-band-horizontal':
        if (x <= 0.28) {
          return 0;
        }

        return 1 + Math.min(zoneCount - 2, Math.floor(y * (zoneCount - 1)));
      case 'nordic-cross':
        return (x >= 0.3 && x <= 0.46) || (y >= 0.415 && y <= 0.585) ? 1 : 0;
    }
  }

  private rgbDistance(
    leftRed: number,
    leftGreen: number,
    leftBlue: number,
    rightRed: number,
    rightGreen: number,
    rightBlue: number,
  ): number {
    const red = leftRed - rightRed;
    const green = leftGreen - rightGreen;
    const blue = leftBlue - rightBlue;
    return Math.sqrt(red * red * 0.3 + green * green * 0.59 + blue * blue * 0.11);
  }

  private pickPuzzle(excludedCode?: string): FlagRebuildPuzzle {
    const candidates = excludedCode
      ? this.allPuzzles.filter((puzzle) => puzzle.code !== excludedCode)
      : this.allPuzzles;
    return candidates[Math.floor(Math.random() * candidates.length)] ?? this.allPuzzles[0];
  }

  private shuffle<T>(values: T[]): T[] {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  private computeColorProximity(left: string, right: string): number {
    const distance = this.computePerceptualDistance(left.toLowerCase(), right.toLowerCase());

    if (!Number.isFinite(distance)) {
      return 0;
    }

    return Math.max(0, Math.min(1, 1 - distance / 92));
  }

  private computePerceptualDistance(left: string, right: string): number {
    const a = this.hexToRgb(left);
    const b = this.hexToRgb(right);

    if (!a || !b) {
      return Number.POSITIVE_INFINITY;
    }

    const labA = this.rgbToLab(a);
    const labB = this.rgbToLab(b);
    const dL = labA.l - labB.l;
    const dA = labA.a - labB.a;
    const dB = labA.b - labB.b;
    return Math.sqrt(dL * dL + dA * dA + dB * dB);
  }

  private rgbToLab(color: { r: number; g: number; b: number }): {
    l: number;
    a: number;
    b: number;
  } {
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
      b: 200 * (fy - fz),
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
      b: value & 255,
    };
  }

  private createEnglishRegionNames(): Intl.DisplayNames | null {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      return null;
    }
  }
}
