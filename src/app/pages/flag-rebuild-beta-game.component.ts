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

type PixelZoneMask = {
  puzzleCode: string;
  width: number;
  height: number;
  zoneIndexes: Uint8Array;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type StripeAxis = 'x' | 'y';

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
  private readonly pixelMaskCache = new Map<string, PixelZoneMask | null>();
  private readonly pixelMaskRequests = new Map<string, Promise<PixelZoneMask | null>>();

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
      const puzzle = this.currentPuzzle();
      void this.preparePixelMask(puzzle);
    });

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
        if (this.previewColorsForPattern().length > 3) {
          return this.i18n.t('rebuild.zone.stripe', { index: index + 1 });
        }

        return (
          [
            this.i18n.t('rebuild.zone.left'),
            this.i18n.t('rebuild.zone.center'),
            this.i18n.t('rebuild.zone.right'),
          ][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'horizontal-stripes':
        if (this.previewColorsForPattern().length > 3) {
          return this.i18n.t('rebuild.zone.stripe', { index: index + 1 });
        }

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
    const pixelMask = this.getTargetPatternPixelMask();

    this.selectZone(
      pixelMask
        ? this.findPixelMaskZoneAtPoint(pixelMask, x, y)
        : this.findZoneAtPoint(this.selectedPattern(), x, y, this.previewColorsForPattern().length),
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
    const pixelMask = this.getTargetPatternPixelMask();

    if (pixelMask) {
      this.drawPixelMaskPattern(context, pixelMask, this.previewColorsForPattern());
      this.drawPixelMaskSelectedZone(context, pixelMask, this.selectedZoneIndex());
      return;
    }

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
    if (selectedPattern === puzzle.targetPattern) {
      const pixelMask = await this.loadPixelMask(puzzle);
      if (pixelMask) {
        return this.computePixelMaskScore(pixelMask, puzzle.targetColors, userColors);
      }
    }

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

  private async preparePixelMask(puzzle: FlagRebuildPuzzle): Promise<void> {
    const pixelMask = await this.loadPixelMask(puzzle);
    if (this.currentPuzzle().code !== puzzle.code || !pixelMask) {
      return;
    }

    this.renderPlayerCanvas();
  }

  private async loadPixelMask(puzzle: FlagRebuildPuzzle): Promise<PixelZoneMask | null> {
    if (this.pixelMaskCache.has(puzzle.code)) {
      return this.pixelMaskCache.get(puzzle.code) ?? null;
    }

    const activeRequest = this.pixelMaskRequests.get(puzzle.code);
    if (activeRequest) {
      return activeRequest;
    }

    const request = this.createPixelMask(puzzle);
    this.pixelMaskRequests.set(puzzle.code, request);
    const pixelMask = await request;
    this.pixelMaskRequests.delete(puzzle.code);
    this.pixelMaskCache.set(puzzle.code, pixelMask);
    return pixelMask;
  }

  private async createPixelMask(puzzle: FlagRebuildPuzzle): Promise<PixelZoneMask | null> {
    const reference = await this.loadRealFlagImageData(puzzle.flagUrl);
    if (!reference) {
      return null;
    }

    const orderedStripeZoneIndexes =
      puzzle.targetPattern === 'horizontal-stripes'
        ? this.createOrderedStripeZoneIndexes(reference, puzzle.targetColors, 'y')
        : puzzle.targetPattern === 'vertical-stripes'
          ? this.createOrderedStripeZoneIndexes(reference, puzzle.targetColors, 'x')
          : null;
    const zoneIndexes = new Uint8Array(reference.width * reference.height);

    for (let pixelIndex = 0; pixelIndex < zoneIndexes.length; pixelIndex += 1) {
      const dataIndex = pixelIndex * 4;
      zoneIndexes[pixelIndex] = orderedStripeZoneIndexes
        ? orderedStripeZoneIndexes[
            puzzle.targetPattern === 'horizontal-stripes'
              ? Math.floor(pixelIndex / reference.width)
              : pixelIndex % reference.width
          ]
        : this.findClosestTargetColorIndex(
            reference.data[dataIndex],
            reference.data[dataIndex + 1],
            reference.data[dataIndex + 2],
            puzzle.targetColors,
          );
    }

    return {
      puzzleCode: puzzle.code,
      width: reference.width,
      height: reference.height,
      zoneIndexes,
    };
  }

  private createOrderedStripeZoneIndexes(
    reference: ImageData,
    targetColors: string[],
    axis: StripeAxis,
  ): Uint8Array | null {
    const targetRgbColors = targetColors.map((color) => this.hexToRgb(color));
    if (targetRgbColors.some((color) => !color)) {
      return null;
    }

    const samples = this.computeAxisAverageColors(reference, axis);
    const boundaries = this.findBestOrderedStripeBoundaries(samples, targetRgbColors as RgbColor[]);
    if (!boundaries) {
      return null;
    }

    const zoneIndexes = new Uint8Array(samples.length);
    let zoneIndex = 0;

    for (let index = 0; index < samples.length; index += 1) {
      while (zoneIndex < targetColors.length - 1 && index >= boundaries[zoneIndex + 1]) {
        zoneIndex += 1;
      }

      zoneIndexes[index] = zoneIndex;
    }

    return zoneIndexes;
  }

  private computeAxisAverageColors(reference: ImageData, axis: StripeAxis): RgbColor[] {
    const sampleCount = axis === 'y' ? reference.height : reference.width;
    const span = axis === 'y' ? reference.width : reference.height;

    return Array.from({ length: sampleCount }, (_, sampleIndex) => {
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let spanIndex = 0; spanIndex < span; spanIndex += 1) {
        const x = axis === 'y' ? spanIndex : sampleIndex;
        const y = axis === 'y' ? sampleIndex : spanIndex;
        const dataIndex = (y * reference.width + x) * 4;
        red += reference.data[dataIndex];
        green += reference.data[dataIndex + 1];
        blue += reference.data[dataIndex + 2];
      }

      return {
        r: red / span,
        g: green / span,
        b: blue / span,
      };
    });
  }

  private findBestOrderedStripeBoundaries(
    samples: RgbColor[],
    targetColors: RgbColor[],
  ): number[] | null {
    const sampleCount = samples.length;
    const zoneCount = targetColors.length;
    if (sampleCount < zoneCount || zoneCount === 0) {
      return null;
    }

    const costPrefixes = targetColors.map((targetColor) => {
      const prefix = new Float64Array(sampleCount + 1);
      samples.forEach((sample, index) => {
        prefix[index + 1] =
          prefix[index] +
          this.rgbDistance(
            sample.r,
            sample.g,
            sample.b,
            targetColor.r,
            targetColor.g,
            targetColor.b,
          );
      });
      return prefix;
    });
    const scores = Array.from({ length: zoneCount }, () =>
      new Float64Array(sampleCount + 1).fill(Number.POSITIVE_INFINITY),
    );
    const splits = Array.from({ length: zoneCount }, () =>
      new Int16Array(sampleCount + 1).fill(-1),
    );

    for (let end = 1; end <= sampleCount - (zoneCount - 1); end += 1) {
      scores[0][end] = costPrefixes[0][end] - costPrefixes[0][0];
    }

    for (let zoneIndex = 1; zoneIndex < zoneCount; zoneIndex += 1) {
      const minEnd = zoneIndex + 1;
      const maxEnd = sampleCount - (zoneCount - zoneIndex - 1);

      for (let end = minEnd; end <= maxEnd; end += 1) {
        for (let start = zoneIndex; start < end; start += 1) {
          const score =
            scores[zoneIndex - 1][start] +
            costPrefixes[zoneIndex][end] -
            costPrefixes[zoneIndex][start];

          if (score < scores[zoneIndex][end]) {
            scores[zoneIndex][end] = score;
            splits[zoneIndex][end] = start;
          }
        }
      }
    }

    if (!Number.isFinite(scores[zoneCount - 1][sampleCount])) {
      return null;
    }

    const boundaries = new Array<number>(zoneCount + 1);
    boundaries[0] = 0;
    boundaries[zoneCount] = sampleCount;
    let end = sampleCount;

    for (let zoneIndex = zoneCount - 1; zoneIndex > 0; zoneIndex -= 1) {
      const start = splits[zoneIndex][end];
      if (start < 0) {
        return null;
      }

      boundaries[zoneIndex] = start;
      end = start;
    }

    return boundaries;
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

  private drawPixelMaskPattern(
    context: CanvasRenderingContext2D,
    pixelMask: PixelZoneMask,
    colors: string[],
  ): void {
    context.clearRect(0, 0, pixelMask.width, pixelMask.height);
    const imageData = context.createImageData(pixelMask.width, pixelMask.height);
    const fallbackColor = { r: 247, g: 243, b: 234 };
    const rgbColors = colors.map((color) => this.hexToRgb(color) ?? fallbackColor);

    for (let pixelIndex = 0; pixelIndex < pixelMask.zoneIndexes.length; pixelIndex += 1) {
      const color = rgbColors[pixelMask.zoneIndexes[pixelIndex]] ?? fallbackColor;
      const dataIndex = pixelIndex * 4;
      imageData.data[dataIndex] = color.r;
      imageData.data[dataIndex + 1] = color.g;
      imageData.data[dataIndex + 2] = color.b;
      imageData.data[dataIndex + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);
  }

  private drawPixelMaskSelectedZone(
    context: CanvasRenderingContext2D,
    pixelMask: PixelZoneMask,
    zoneIndex: number,
  ): void {
    context.save();
    context.fillStyle = 'rgba(255, 255, 255, 0.86)';

    for (let y = 0; y < pixelMask.height; y += 1) {
      for (let x = 0; x < pixelMask.width; x += 1) {
        if (!this.isPixelMaskEdge(pixelMask, x, y, zoneIndex)) {
          continue;
        }

        context.fillRect(x, y, 1, 1);
      }
    }

    context.restore();
  }

  private isPixelMaskEdge(
    pixelMask: PixelZoneMask,
    x: number,
    y: number,
    zoneIndex: number,
  ): boolean {
    const pixelIndex = y * pixelMask.width + x;
    if (pixelMask.zoneIndexes[pixelIndex] !== zoneIndex) {
      return false;
    }

    return (
      x === 0 ||
      y === 0 ||
      x === pixelMask.width - 1 ||
      y === pixelMask.height - 1 ||
      pixelMask.zoneIndexes[pixelIndex - 1] !== zoneIndex ||
      pixelMask.zoneIndexes[pixelIndex + 1] !== zoneIndex ||
      pixelMask.zoneIndexes[pixelIndex - pixelMask.width] !== zoneIndex ||
      pixelMask.zoneIndexes[pixelIndex + pixelMask.width] !== zoneIndex
    );
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

  private getTargetPatternPixelMask(): PixelZoneMask | null {
    const puzzle = this.currentPuzzle();
    if (this.selectedPattern() !== puzzle.targetPattern) {
      return null;
    }

    return this.pixelMaskCache.get(puzzle.code) ?? null;
  }

  private findPixelMaskZoneAtPoint(pixelMask: PixelZoneMask, x: number, y: number): number {
    const pixelX = Math.max(0, Math.min(pixelMask.width - 1, Math.floor(x * pixelMask.width)));
    const pixelY = Math.max(0, Math.min(pixelMask.height - 1, Math.floor(y * pixelMask.height)));
    return pixelMask.zoneIndexes[pixelY * pixelMask.width + pixelX] ?? 0;
  }

  private computePixelMaskScore(
    pixelMask: PixelZoneMask,
    targetColors: string[],
    userColors: string[],
  ): number {
    const zoneProximities = targetColors.map((targetColor, index) =>
      this.computeColorProximity(userColors[index] ?? '#ffffff', targetColor),
    );
    let totalProximity = 0;

    for (let index = 0; index < pixelMask.zoneIndexes.length; index += 1) {
      totalProximity += zoneProximities[pixelMask.zoneIndexes[index]] ?? 0;
    }

    const pixelWeightedScore = totalProximity / Math.max(1, pixelMask.zoneIndexes.length);
    const zoneAverageScore =
      zoneProximities.reduce((sum, score) => sum + score, 0) / Math.max(1, zoneProximities.length);

    return Math.round((pixelWeightedScore * 0.85 + zoneAverageScore * 0.15) * 100);
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

  private findClosestTargetColorIndex(
    red: number,
    green: number,
    blue: number,
    targetColors: string[],
  ): number {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    targetColors.forEach((targetColor, index) => {
      const rgb = this.hexToRgb(targetColor);
      if (!rgb) {
        return;
      }

      const distance = this.rgbDistance(red, green, blue, rgb.r, rgb.g, rgb.b);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });

    return closestIndex;
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
