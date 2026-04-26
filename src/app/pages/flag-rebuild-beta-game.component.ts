import { Component, computed, inject, signal } from '@angular/core';
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
  patternScore: number;
  zoneScores: number[];
  labelKey: string;
};

@Component({
  selector: 'app-flag-rebuild-beta-game',
  templateUrl: './flag-rebuild-beta-game.component.html',
  styleUrl: './flag-rebuild-beta-game.component.css'
})
export class FlagRebuildBetaGameComponent {
  protected readonly i18n = inject(I18nService);
  private readonly englishRegionNames = this.createEnglishRegionNames();
  private readonly allPuzzles = FLAG_REBUILD_PUZZLES;
  protected readonly currentPuzzle = signal<FlagRebuildPuzzle>(this.pickPuzzle());
  protected readonly selectedPattern = signal<FlagRebuildPattern>(this.currentPuzzle().targetPattern);
  protected readonly selectedZoneIndex = signal(0);
  protected readonly pieces = signal<BetaPiece[]>(this.buildInitialPieces(this.currentPuzzle()));
  protected readonly result = signal<BetaResult | null>(null);
  protected readonly round = signal(1);
  protected readonly totalScore = signal(0);

  protected readonly activePiece = computed(() => this.pieces()[this.selectedZoneIndex()] ?? null);
  protected readonly previewColors = computed(() => this.pieces().map((piece) => piece.color));
  protected readonly previewColorsForPattern = computed(() => {
    const puzzle = this.currentPuzzle();
    return this.getPatternPreviewColors(
      this.selectedPattern(),
      this.previewColors(),
      puzzle.targetColors.length
    );
  });
  protected readonly paletteOptions = computed(() => this.buildPaletteOptions(this.currentPuzzle()));
  protected readonly masteryPercent = computed(() => Math.min(100, Math.round((this.totalScore() / Math.max(1, this.round() * 100)) * 100)));

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
        return [this.i18n.t('rebuild.zone.left'), this.i18n.t('rebuild.zone.center'), this.i18n.t('rebuild.zone.right')][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 });
      case 'horizontal-stripes':
        return [this.i18n.t('rebuild.zone.top'), this.i18n.t('rebuild.zone.middle'), this.i18n.t('rebuild.zone.bottom')][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 });
      case 'triangle-left-bands-2':
        return [this.i18n.t('rebuild.zone.triangle'), this.i18n.t('rebuild.zone.topRight'), this.i18n.t('rebuild.zone.bottomRight')][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 });
      case 'triangle-left-bands-3':
        return [this.i18n.t('rebuild.zone.triangle'), this.i18n.t('rebuild.zone.topRight'), this.i18n.t('rebuild.zone.middleRight'), this.i18n.t('rebuild.zone.bottomRight')][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 });
      case 'left-band-horizontal':
        return [this.i18n.t('rebuild.zone.leftBand'), this.i18n.t('rebuild.zone.topRight'), this.i18n.t('rebuild.zone.middleRight'), this.i18n.t('rebuild.zone.bottomRight')][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 });
      case 'nordic-cross':
        return [this.i18n.t('rebuild.zone.background'), this.i18n.t('rebuild.zone.cross')][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 });
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
      pieces.map((piece) => (piece.id === activePiece.id ? { ...piece, color } : piece))
    );
  }

  protected submitRound(): void {
    const result = this.evaluatePuzzle(
      this.currentPuzzle(),
      this.selectedPattern(),
      this.previewColors()
    );

    this.result.set(result);
    this.totalScore.update((score) => score + result.score);
  }

  protected retryRound(): void {
    this.result.set(null);
  }

  protected nextRound(): void {
    const nextPuzzle = this.pickPuzzle(this.currentPuzzle().code);
    this.currentPuzzle.set(nextPuzzle);
    this.selectedPattern.set(this.shuffle([...nextPuzzle.patternOptions])[0] ?? nextPuzzle.targetPattern);
    this.pieces.set(this.buildInitialPieces(nextPuzzle));
    this.selectedZoneIndex.set(0);
    this.result.set(null);
    this.round.update((round) => round + 1);
  }

  private evaluatePuzzle(
    puzzle: FlagRebuildPuzzle,
    selectedPattern: FlagRebuildPattern,
    userColors: string[]
  ): BetaResult {
    const zoneScores = puzzle.targetColors.map((targetColor, index) =>
      Math.round(this.computeColorProximity(userColors[index] ?? '#ffffff', targetColor) * 100)
    );
    const colorScore = Math.round(
      zoneScores.reduce((sum, score) => sum + score, 0) / Math.max(1, zoneScores.length)
    );
    const patternScore = selectedPattern === puzzle.targetPattern ? 100 : 58;
    const score = Math.round(colorScore * (patternScore / 100));

    return {
      score,
      colorScore,
      patternScore,
      zoneScores,
      labelKey: this.getResultLabelKey(score)
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
      color: '#f7f3ea'
    }));
  }

  private fitPiecesToPattern(
    pattern: FlagRebuildPattern,
    pieces: BetaPiece[],
    puzzle: FlagRebuildPuzzle
  ): BetaPiece[] {
    const zoneCount = this.getPatternZoneCount(pattern, puzzle.targetColors.length);

    return Array.from({ length: zoneCount }, (_, index) => {
      return pieces[index] ?? {
        id: `${puzzle.code}-beta-${index}`,
        color: '#f7f3ea'
      };
    });
  }

  private buildPaletteOptions(puzzle: FlagRebuildPuzzle): string[] {
    return Array.from(new Set([...puzzle.palette, '#111111', '#ffffff', '#f7f3ea']));
  }

  private getPatternPreviewColors(
    pattern: FlagRebuildPattern,
    sourceColors: string[],
    colorCount: number
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

  private createEnglishRegionNames(): Intl.DisplayNames | null {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      return null;
    }
  }
}
