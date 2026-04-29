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
type RatioPoint = readonly [number, number];

const FLAG_CANVAS_WIDTH = 360;
const FLAG_CANVAS_HEIGHT = 240;
const BETA_EMPTY_COLOR = '#f7f3ea';
const DIAGONAL_RAY_POLYGONS: RatioPoint[][] = [
  [
    [0, 0],
    [0.24, 0],
    [0, 1],
  ],
  [
    [0.24, 0],
    [0.49, 0],
    [0, 1],
  ],
  [
    [0.49, 0],
    [0.76, 0],
    [0, 1],
  ],
  [
    [0.76, 0],
    [1, 0],
    [0, 1],
  ],
  [
    [1, 0],
    [1, 1],
    [0, 1],
  ],
];
const BETA_PATTERN_CHOICE_COUNT = 4;
const BETA_FLAG_REBUILD_PATTERNS: FlagRebuildPattern[] = [
  'horizontal-stripes',
  'vertical-stripes',
  'triangle-left-bands-2',
  'triangle-left-bands-3',
  'left-band-horizontal',
  'nordic-cross',
  'center-disc',
  'horizontal-stripes-center-disc',
  'saltire',
  'diagonal-rays',
];
const BETA_SHARED_DECOY_COLORS = [
  '#111111',
  '#ffffff',
  '#f7f3ea',
  '#174a7c',
  '#2f8f5b',
  '#c23b22',
  '#f0b429',
  '#6f3fb5',
];
const BETA_EXTRA_FLAG_REBUILD_PUZZLES: FlagRebuildPuzzle[] = [
  {
    code: 'id',
    nameFrench: 'Indonésie',
    targetPattern: 'horizontal-stripes',
    patternOptions: ['horizontal-stripes', 'vertical-stripes', 'center-disc'],
    targetColors: ['#ff0000', '#ffffff'],
    palette: ['#e63737', '#f5f5f5', '#ff0000', '#ffffff'],
    flagUrl: 'https://flagcdn.com/w320/id.png',
  },
  {
    code: 'lv',
    nameFrench: 'Lettonie',
    targetPattern: 'horizontal-stripes',
    patternOptions: ['horizontal-stripes', 'vertical-stripes', 'left-band-horizontal'],
    targetColors: ['#9e3039', '#ffffff', '#9e3039'],
    palette: ['#b64a53', '#f5f5f5', '#9e3039', '#ffffff'],
    flagUrl: 'https://flagcdn.com/w320/lv.png',
  },
  {
    code: 'es',
    nameFrench: 'Espagne',
    targetPattern: 'horizontal-stripes',
    patternOptions: ['horizontal-stripes', 'vertical-stripes', 'left-band-horizontal'],
    targetColors: ['#aa151b', '#f1bf00', '#aa151b'],
    palette: ['#c7353a', '#ffd33d', '#aa151b', '#f1bf00'],
    flagUrl: 'https://flagcdn.com/w320/es.png',
  },
  {
    code: 'co',
    nameFrench: 'Colombie',
    targetPattern: 'horizontal-stripes',
    patternOptions: ['horizontal-stripes', 'vertical-stripes', 'left-band-horizontal'],
    targetColors: ['#fcd116', '#003893', '#ce1126'],
    palette: ['#ffe04b', '#2b58ac', '#df3a4d', '#fcd116', '#003893', '#ce1126'],
    flagUrl: 'https://flagcdn.com/w320/co.png',
  },
  {
    code: 'cr',
    nameFrench: 'Costa Rica',
    targetPattern: 'horizontal-stripes',
    patternOptions: ['horizontal-stripes', 'vertical-stripes', 'left-band-horizontal'],
    targetColors: ['#002b7f', '#ffffff', '#ce1126', '#ffffff', '#002b7f'],
    palette: ['#264c9f', '#f5f5f5', '#de3448', '#002b7f', '#ffffff', '#ce1126'],
    flagUrl: 'https://flagcdn.com/w320/cr.png',
  },
  {
    code: 'jp',
    nameFrench: 'Japon',
    targetPattern: 'center-disc',
    patternOptions: ['center-disc', 'horizontal-stripes', 'vertical-stripes'],
    targetColors: ['#ffffff', '#bc002d'],
    palette: ['#f5f5f5', '#d12f52', '#ffffff', '#bc002d'],
    flagUrl: 'https://flagcdn.com/w320/jp.png',
  },
  {
    code: 'bd',
    nameFrench: 'Bangladesh',
    targetPattern: 'center-disc',
    patternOptions: ['center-disc', 'horizontal-stripes-center-disc', 'vertical-stripes'],
    targetColors: ['#006a4e', '#f42a41'],
    palette: ['#258564', '#ff4b61', '#006a4e', '#f42a41'],
    flagUrl: 'https://flagcdn.com/w320/bd.png',
  },
  {
    code: 'pw',
    nameFrench: 'Palaos',
    targetPattern: 'center-disc',
    patternOptions: ['center-disc', 'horizontal-stripes-center-disc', 'horizontal-stripes'],
    targetColors: ['#0099ff', '#ffde00'],
    palette: ['#2eb0ff', '#ffe04b', '#0099ff', '#ffde00'],
    flagUrl: 'https://flagcdn.com/w320/pw.png',
  },
  {
    code: 'la',
    nameFrench: 'Laos',
    targetPattern: 'horizontal-stripes-center-disc',
    patternOptions: ['horizontal-stripes-center-disc', 'horizontal-stripes', 'center-disc'],
    targetColors: ['#ce1126', '#002868', '#ce1126', '#ffffff'],
    palette: ['#df3d4f', '#244b8b', '#f5f5f5', '#ce1126', '#002868', '#ffffff'],
    flagUrl: 'https://flagcdn.com/w320/la.png',
  },
  {
    code: 'jm',
    nameFrench: 'Jamaïque',
    targetPattern: 'saltire',
    patternOptions: ['saltire', 'diagonal-rays', 'nordic-cross'],
    targetColors: ['#009b3a', '#fed100', '#000000'],
    palette: ['#24b85a', '#ffe04b', '#2a2a2a', '#009b3a', '#fed100', '#000000'],
    flagUrl: 'https://flagcdn.com/w320/jm.png',
  },
  {
    code: 'sc',
    nameFrench: 'Seychelles',
    targetPattern: 'diagonal-rays',
    patternOptions: ['diagonal-rays', 'horizontal-stripes', 'triangle-left-bands-3'],
    targetColors: ['#003f87', '#fcd856', '#d62828', '#ffffff', '#007a3d'],
    palette: [
      '#255fa0',
      '#ffe16b',
      '#e64a4a',
      '#f5f5f5',
      '#24945b',
      '#003f87',
      '#fcd856',
      '#d62828',
      '#ffffff',
      '#007a3d',
    ],
    flagUrl: 'https://flagcdn.com/w320/sc.png',
  },
  {
    code: 'ps',
    nameFrench: 'Palestine',
    targetPattern: 'triangle-left-bands-3',
    patternOptions: ['triangle-left-bands-3', 'horizontal-stripes', 'left-band-horizontal'],
    targetColors: ['#e4312b', '#000000', '#ffffff', '#149954'],
    palette: [
      '#f0524c',
      '#2a2a2a',
      '#f5f5f5',
      '#34ad70',
      '#e4312b',
      '#000000',
      '#ffffff',
      '#149954',
    ],
    flagUrl: 'https://flagcdn.com/w320/ps.png',
  },
  {
    code: 'sd',
    nameFrench: 'Soudan',
    targetPattern: 'triangle-left-bands-3',
    patternOptions: ['triangle-left-bands-3', 'horizontal-stripes', 'left-band-horizontal'],
    targetColors: ['#007229', '#d21034', '#ffffff', '#000000'],
    palette: [
      '#24914c',
      '#e23d5c',
      '#f5f5f5',
      '#2a2a2a',
      '#007229',
      '#d21034',
      '#ffffff',
      '#000000',
    ],
    flagUrl: 'https://flagcdn.com/w320/sd.png',
  },
];

@Component({
  selector: 'app-flag-rebuild-beta-game',
  templateUrl: './flag-rebuild-beta-game.component.html',
  styleUrl: './flag-rebuild-beta-game.component.css',
})
export class FlagRebuildBetaGameComponent implements AfterViewInit {
  protected readonly i18n = inject(I18nService);
  private readonly englishRegionNames = this.createEnglishRegionNames();
  private readonly allPuzzles = [...FLAG_REBUILD_PUZZLES, ...BETA_EXTRA_FLAG_REBUILD_PUZZLES];
  @ViewChild('playerCanvas') private playerCanvas?: ElementRef<HTMLCanvasElement>;
  protected readonly currentPuzzle = signal<FlagRebuildPuzzle>(this.pickPuzzle());
  protected readonly patternChoices = signal<PatternChoice[]>(
    this.buildPatternChoices(this.currentPuzzle()),
  );
  protected readonly paletteOptions = signal<string[]>(
    this.buildPaletteOptions(this.currentPuzzle()),
  );
  protected readonly selectedPattern = signal<FlagRebuildPattern>(
    this.pickInitialPattern(this.patternChoices()),
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
  protected readonly completedRounds = signal(0);
  protected readonly currentRoundScore = signal(0);
  protected readonly hasScoredCurrentRound = signal(false);
  protected readonly isScoring = signal(false);
  private readonly realFlagCache = new Map<string, ImageData | null>();
  private readonly pixelMaskCache = new Map<string, PixelZoneMask | null>();
  private readonly pixelMaskRequests = new Map<string, Promise<PixelZoneMask | null>>();
  private readonly patternMaskCache = new Map<string, PixelZoneMask>();

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
  protected readonly zoneCount = computed(() => this.previewColorsForPattern().length);
  protected readonly filledZoneCount = computed(
    () => this.previewColorsForPattern().filter((color) => !this.isEmptyColor(color)).length,
  );
  protected readonly isReadyToScan = computed(
    () => this.filledZoneCount() === this.zoneCount() && !this.isScoring(),
  );
  protected readonly masteryPercent = computed(() =>
    Math.min(
      100,
      Math.round((this.totalScore() / Math.max(1, this.completedRounds() * 100)) * 100),
    ),
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
      case 'center-disc':
        return (
          [this.i18n.t('rebuild.zone.background'), this.i18n.t('rebuild.zone.disc')][index] ??
          this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'horizontal-stripes-center-disc': {
        const discIndex = this.previewColorsForPattern().length - 1;
        if (index === discIndex) {
          return this.i18n.t('rebuild.zone.disc');
        }

        return this.i18n.t('rebuild.zone.stripe', { index: index + 1 });
      }
      case 'saltire':
        return (
          [
            this.i18n.t('rebuild.zone.background'),
            this.i18n.t('rebuild.zone.saltire'),
            this.i18n.t('rebuild.zone.sideFields'),
          ][index] ?? this.i18n.t('rebuild.zone.generic', { index: index + 1 })
        );
      case 'diagonal-rays':
        return this.i18n.t('rebuild.zone.stripe', { index: index + 1 });
      default:
        return this.i18n.t('rebuild.zone.generic', { index: index + 1 });
    }
  }

  protected isBlankColor(color: string | undefined): boolean {
    return this.isEmptyColor(color) || color?.toLowerCase() === '#ffffff';
  }

  protected selectPattern(pattern: FlagRebuildPattern): void {
    this.selectedPattern.set(pattern);
    this.selectedZoneIndex.set(0);
    this.clearCurrentRoundResult();
    this.pieces.set(this.fitPiecesToPattern(pattern, this.pieces(), this.currentPuzzle()));
  }

  protected selectZone(index: number): void {
    this.selectedZoneIndex.set(index);
    this.clearCurrentRoundResult();
  }

  protected selectColor(color: string): void {
    const activePiece = this.activePiece();
    if (!activePiece) {
      return;
    }

    const activeIndex = this.selectedZoneIndex();
    this.clearCurrentRoundResult();
    this.pieces.update((pieces) =>
      pieces.map((piece) => (piece.id === activePiece.id ? { ...piece, color } : piece)),
    );
    this.advanceToNextOpenZone(activeIndex);
  }

  protected async submitRound(): Promise<void> {
    if (!this.isReadyToScan()) {
      return;
    }

    const previousScore = this.currentRoundScore();
    const hadScore = this.hasScoredCurrentRound();
    this.isScoring.set(true);

    try {
      const result = await this.evaluatePuzzle(
        this.currentPuzzle(),
        this.selectedPattern(),
        this.previewColors(),
      );

      this.result.set(result);
      this.currentRoundScore.set(result.score);
      this.hasScoredCurrentRound.set(true);
      this.totalScore.update((score) => score - previousScore + result.score);
      if (!hadScore) {
        this.completedRounds.update((rounds) => rounds + 1);
      }
    } finally {
      this.isScoring.set(false);
    }
  }

  protected retryRound(): void {
    this.clearCurrentRoundResult();
  }

  protected nextRound(): void {
    const nextPuzzle = this.pickPuzzle(this.currentPuzzle().code);
    const nextPatternChoices = this.buildPatternChoices(nextPuzzle);
    const nextPattern = this.pickInitialPattern(nextPatternChoices);
    this.currentPuzzle.set(nextPuzzle);
    this.patternChoices.set(nextPatternChoices);
    this.paletteOptions.set(this.buildPaletteOptions(nextPuzzle));
    this.selectedPattern.set(nextPattern);
    this.pieces.set(
      this.fitPiecesToPattern(nextPattern, this.buildInitialPieces(nextPuzzle), nextPuzzle),
    );
    this.selectedZoneIndex.set(0);
    this.result.set(null);
    this.currentRoundScore.set(0);
    this.hasScoredCurrentRound.set(false);
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
    const pixelMask = this.getActivePatternPixelMask();

    this.selectZone(this.findPixelMaskZoneAtPoint(pixelMask, x, y));
  }

  private clearCurrentRoundResult(): void {
    if (this.hasScoredCurrentRound()) {
      this.totalScore.update((score) => Math.max(0, score - this.currentRoundScore()));
      this.completedRounds.update((rounds) => Math.max(0, rounds - 1));
      this.currentRoundScore.set(0);
      this.hasScoredCurrentRound.set(false);
    }

    this.result.set(null);
  }

  private advanceToNextOpenZone(currentIndex: number): void {
    const colors = this.previewColorsForPattern();
    const zoneCount = colors.length;
    if (zoneCount <= 1) {
      return;
    }

    for (let offset = 1; offset <= zoneCount; offset += 1) {
      const nextIndex = (currentIndex + offset) % zoneCount;
      if (this.isEmptyColor(colors[nextIndex])) {
        this.selectedZoneIndex.set(nextIndex);
        return;
      }
    }

    this.selectedZoneIndex.set((currentIndex + 1) % zoneCount);
  }

  private isEmptyColor(color: string | undefined): boolean {
    return color?.toLowerCase() === BETA_EMPTY_COLOR;
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
      color: BETA_EMPTY_COLOR,
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
          color: BETA_EMPTY_COLOR,
        }
      );
    });
  }

  private buildPaletteOptions(puzzle: FlagRebuildPuzzle): string[] {
    const targetColors = Array.from(new Set(puzzle.targetColors));
    const relatedPalette = puzzle.palette.filter(
      (color) =>
        !targetColors.some((targetColor) => this.areColorsTooClose(color, targetColor, 16)),
    );
    const distantFlagColors = this.shuffle(
      this.allPuzzles
        .filter((candidate) => candidate.code !== puzzle.code)
        .flatMap((candidate) => candidate.targetColors)
        .filter((color) =>
          targetColors.every((targetColor) => !this.areColorsTooClose(color, targetColor, 24)),
        ),
    ).slice(0, Math.max(4, targetColors.length + 1));
    const generatedDecoys = targetColors
      .flatMap((color) => [this.rotateColor(color, 58), this.rotateColor(color, -42)])
      .filter((color): color is string => !!color)
      .filter((color) =>
        targetColors.every((targetColor) => !this.areColorsTooClose(color, targetColor, 28)),
      );

    const decoys = Array.from(
      new Set([
        ...this.shuffle(relatedPalette).slice(0, 2),
        ...distantFlagColors,
        ...generatedDecoys,
        ...BETA_SHARED_DECOY_COLORS.filter((color) =>
          targetColors.every((targetColor) => color !== targetColor),
        ),
      ]),
    );

    return this.shuffle([
      ...targetColors,
      ...this.shuffle(decoys).slice(0, Math.max(4, 8 - targetColors.length)),
    ]);
  }

  private buildPatternChoices(puzzle: FlagRebuildPuzzle): PatternChoice[] {
    const decoys = this.shuffle(
      BETA_FLAG_REBUILD_PATTERNS.filter((pattern) => pattern !== puzzle.targetPattern),
    ).slice(0, BETA_PATTERN_CHOICE_COUNT - 1);

    return this.shuffle([puzzle.targetPattern, ...decoys]).map((pattern) => ({
      pattern,
    }));
  }

  private pickInitialPattern(patternChoices: PatternChoice[]): FlagRebuildPattern {
    return this.shuffle(patternChoices.map((choice) => choice.pattern))[0] ?? 'horizontal-stripes';
  }

  private getPatternPreviewColors(
    pattern: FlagRebuildPattern,
    sourceColors: string[],
    colorCount: number,
  ): string[] {
    const zoneCount = this.getPatternZoneCount(pattern, colorCount);

    return Array.from({ length: zoneCount }, (_, index) => sourceColors[index] ?? BETA_EMPTY_COLOR);
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
      case 'center-disc':
        return 2;
      case 'horizontal-stripes-center-disc':
      case 'saltire':
        return colorCount;
      case 'diagonal-rays':
        return DIAGONAL_RAY_POLYGONS.length;
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
    const pixelMask = this.getActivePatternPixelMask();
    this.drawPixelMaskPattern(context, pixelMask, this.previewColorsForPattern());
    this.drawPixelMaskZoneGuides(context, pixelMask);
    this.drawPixelMaskSelectedZone(context, pixelMask, this.selectedZoneIndex());
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

    const orderedPatternZoneIndexes = this.createOrderedPatternZoneIndexes(reference, puzzle);
    const zoneIndexes = new Uint8Array(reference.width * reference.height);

    for (let pixelIndex = 0; pixelIndex < zoneIndexes.length; pixelIndex += 1) {
      const dataIndex = pixelIndex * 4;
      zoneIndexes[pixelIndex] = orderedPatternZoneIndexes
        ? orderedPatternZoneIndexes[pixelIndex]
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

  private createOrderedPatternZoneIndexes(
    reference: ImageData,
    puzzle: FlagRebuildPuzzle,
  ): Uint8Array | null {
    switch (puzzle.targetPattern) {
      case 'horizontal-stripes':
        return this.expandAxisZoneIndexes(
          reference,
          this.createOrderedStripeZoneIndexes(reference, puzzle.targetColors, 'y'),
          'y',
        );
      case 'vertical-stripes':
        return this.expandAxisZoneIndexes(
          reference,
          this.createOrderedStripeZoneIndexes(reference, puzzle.targetColors, 'x'),
          'x',
        );
      case 'triangle-left-bands-2':
      case 'triangle-left-bands-3':
        return this.createTriangleBandZoneIndexes(reference, puzzle.targetColors);
      case 'horizontal-stripes-center-disc':
        return this.createStripeDiscZoneIndexes(reference, puzzle.targetColors);
      default:
        return null;
    }
  }

  private expandAxisZoneIndexes(
    reference: ImageData,
    axisZoneIndexes: Uint8Array | null,
    axis: StripeAxis,
  ): Uint8Array | null {
    if (!axisZoneIndexes) {
      return null;
    }

    const zoneIndexes = new Uint8Array(reference.width * reference.height);
    for (let pixelIndex = 0; pixelIndex < zoneIndexes.length; pixelIndex += 1) {
      zoneIndexes[pixelIndex] =
        axis === 'y'
          ? axisZoneIndexes[Math.floor(pixelIndex / reference.width)]
          : axisZoneIndexes[pixelIndex % reference.width];
    }

    return zoneIndexes;
  }

  private createTriangleBandZoneIndexes(
    reference: ImageData,
    targetColors: string[],
  ): Uint8Array | null {
    const bandZoneIndexes = this.createOrderedStripeZoneIndexes(
      reference,
      targetColors.slice(1),
      'y',
      0.64,
      1,
    );
    if (!bandZoneIndexes) {
      return null;
    }

    const zoneIndexes = new Uint8Array(reference.width * reference.height);
    for (let pixelIndex = 0; pixelIndex < zoneIndexes.length; pixelIndex += 1) {
      const dataIndex = pixelIndex * 4;
      const closestIndex = this.findClosestTargetColorIndex(
        reference.data[dataIndex],
        reference.data[dataIndex + 1],
        reference.data[dataIndex + 2],
        targetColors,
      );
      zoneIndexes[pixelIndex] =
        closestIndex === 0 ? 0 : 1 + bandZoneIndexes[Math.floor(pixelIndex / reference.width)];
    }

    return zoneIndexes;
  }

  private createStripeDiscZoneIndexes(
    reference: ImageData,
    targetColors: string[],
  ): Uint8Array | null {
    const discIndex = targetColors.length - 1;
    const bandZoneIndexes = this.createOrderedStripeZoneIndexes(
      reference,
      targetColors.slice(0, discIndex),
      'y',
      0,
      0.22,
    );
    if (!bandZoneIndexes) {
      return null;
    }

    const zoneIndexes = new Uint8Array(reference.width * reference.height);
    for (let pixelIndex = 0; pixelIndex < zoneIndexes.length; pixelIndex += 1) {
      const dataIndex = pixelIndex * 4;
      const closestIndex = this.findClosestTargetColorIndex(
        reference.data[dataIndex],
        reference.data[dataIndex + 1],
        reference.data[dataIndex + 2],
        targetColors,
      );
      zoneIndexes[pixelIndex] =
        closestIndex === discIndex
          ? discIndex
          : bandZoneIndexes[Math.floor(pixelIndex / reference.width)];
    }

    return zoneIndexes;
  }

  private createOrderedStripeZoneIndexes(
    reference: ImageData,
    targetColors: string[],
    axis: StripeAxis,
    crossAxisStart = 0,
    crossAxisEnd = 1,
  ): Uint8Array | null {
    const targetRgbColors = targetColors.map((color) => this.hexToRgb(color));
    if (targetRgbColors.some((color) => !color)) {
      return null;
    }

    const samples = this.computeAxisAverageColors(reference, axis, crossAxisStart, crossAxisEnd);
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

  private computeAxisAverageColors(
    reference: ImageData,
    axis: StripeAxis,
    crossAxisStart = 0,
    crossAxisEnd = 1,
  ): RgbColor[] {
    const sampleCount = axis === 'y' ? reference.height : reference.width;
    const spanSize = axis === 'y' ? reference.width : reference.height;
    const spanStart = Math.max(0, Math.min(spanSize - 1, Math.floor(spanSize * crossAxisStart)));
    const spanEnd = Math.max(spanStart + 1, Math.min(spanSize, Math.ceil(spanSize * crossAxisEnd)));
    const span = spanEnd - spanStart;

    return Array.from({ length: sampleCount }, (_, sampleIndex) => {
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let spanIndex = spanStart; spanIndex < spanEnd; spanIndex += 1) {
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

  private drawPixelMaskZoneGuides(
    context: CanvasRenderingContext2D,
    pixelMask: PixelZoneMask,
  ): void {
    context.save();
    context.fillStyle = 'rgba(45, 31, 52, 0.28)';

    for (let y = 0; y < pixelMask.height; y += 1) {
      for (let x = 0; x < pixelMask.width; x += 1) {
        if (!this.isPixelMaskBoundary(pixelMask, x, y)) {
          continue;
        }

        context.fillRect(x, y, 1, 1);
      }
    }

    context.restore();
  }

  private drawPixelMaskSelectedZone(
    context: CanvasRenderingContext2D,
    pixelMask: PixelZoneMask,
    zoneIndex: number,
  ): void {
    context.save();
    context.fillStyle = 'rgba(21, 126, 251, 0.34)';

    for (let y = 0; y < pixelMask.height; y += 1) {
      for (let x = 0; x < pixelMask.width; x += 1) {
        if (!this.isPixelMaskEdge(pixelMask, x, y, zoneIndex)) {
          continue;
        }

        context.fillRect(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3);
      }
    }

    context.fillStyle = 'rgba(255, 255, 255, 0.96)';

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

  private isPixelMaskBoundary(pixelMask: PixelZoneMask, x: number, y: number): boolean {
    const pixelIndex = y * pixelMask.width + x;
    const zoneIndex = pixelMask.zoneIndexes[pixelIndex];

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
      case 'center-disc':
        context.fillStyle = colors[0] ?? '#f7f3ea';
        context.fillRect(0, 0, width, height);
        context.fillStyle = colors[1] ?? '#f7f3ea';
        context.beginPath();
        context.arc(width * 0.5, height * 0.5, height * 0.24, 0, Math.PI * 2);
        context.fill();
        break;
      case 'horizontal-stripes-center-disc': {
        const discIndex = colors.length - 1;
        const stripeColors = colors.slice(0, discIndex);
        stripeColors.forEach((color, index) => {
          context.fillStyle = color;
          context.fillRect(
            0,
            (index * height) / stripeColors.length,
            width,
            height / stripeColors.length,
          );
        });
        context.fillStyle = colors[discIndex] ?? '#f7f3ea';
        context.beginPath();
        context.arc(width * 0.5, height * 0.5, height * 0.19, 0, Math.PI * 2);
        context.fill();
        break;
      }
      case 'saltire':
        context.fillStyle = colors[0] ?? '#f7f3ea';
        context.fillRect(0, 0, width, height);
        context.fillStyle = colors[2] ?? '#f7f3ea';
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(width * 0.42, height * 0.5);
        context.lineTo(0, height);
        context.closePath();
        context.fill();
        context.beginPath();
        context.moveTo(width, 0);
        context.lineTo(width * 0.58, height * 0.5);
        context.lineTo(width, height);
        context.closePath();
        context.fill();
        context.strokeStyle = colors[1] ?? '#f7f3ea';
        context.lineWidth = height * 0.14;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(width, height);
        context.moveTo(width, 0);
        context.lineTo(0, height);
        context.stroke();
        break;
      case 'diagonal-rays': {
        DIAGONAL_RAY_POLYGONS.forEach((points, index) => {
          context.fillStyle = colors[index] ?? '#f7f3ea';
          this.traceRatioPolygon(context, points, width, height);
          context.fill();
        });
        break;
      }
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
      case 'center-disc':
        if (zoneIndex === 1) {
          context.beginPath();
          context.arc(width * 0.5, height * 0.5, height * 0.24, 0, Math.PI * 2);
          context.stroke();
        } else {
          context.strokeRect(3, 3, width - 6, height - 6);
        }
        break;
      case 'horizontal-stripes-center-disc':
        if (zoneIndex === zoneCount - 1) {
          context.beginPath();
          context.arc(width * 0.5, height * 0.5, height * 0.19, 0, Math.PI * 2);
          context.stroke();
        } else {
          const stripes = zoneCount - 1;
          context.strokeRect(
            3,
            (zoneIndex * height) / stripes + 3,
            width - 6,
            height / stripes - 6,
          );
        }
        break;
      case 'saltire':
        if (zoneIndex === 1) {
          context.beginPath();
          context.moveTo(4, 4);
          context.lineTo(width - 4, height - 4);
          context.moveTo(width - 4, 4);
          context.lineTo(4, height - 4);
          context.stroke();
        } else if (zoneIndex === 2) {
          context.strokeRect(3, 3, width - 6, height - 6);
        } else {
          context.strokeRect(width * 0.2, 3, width * 0.6, height - 6);
        }
        break;
      case 'diagonal-rays':
        this.traceRatioPolygon(
          context,
          DIAGONAL_RAY_POLYGONS[Math.min(zoneIndex, DIAGONAL_RAY_POLYGONS.length - 1)],
          width,
          height,
        );
        context.stroke();
        break;
    }

    context.restore();
  }

  private traceRatioPolygon(
    context: CanvasRenderingContext2D,
    points: RatioPoint[],
    width: number,
    height: number,
  ): void {
    context.beginPath();
    points.forEach(([x, y], pointIndex) => {
      if (pointIndex === 0) {
        context.moveTo(x * width, y * height);
      } else {
        context.lineTo(x * width, y * height);
      }
    });
    context.closePath();
  }

  private getTargetPatternPixelMask(): PixelZoneMask | null {
    const puzzle = this.currentPuzzle();
    if (this.selectedPattern() !== puzzle.targetPattern) {
      return null;
    }

    return this.pixelMaskCache.get(puzzle.code) ?? null;
  }

  private getActivePatternPixelMask(): PixelZoneMask {
    return this.getTargetPatternPixelMask() ?? this.getPatternZoneMask(this.selectedPattern());
  }

  private getPatternZoneMask(pattern: FlagRebuildPattern): PixelZoneMask {
    const zoneCount = this.previewColorsForPattern().length;
    const cacheKey = `${pattern}-${zoneCount}`;
    const cachedMask = this.patternMaskCache.get(cacheKey);
    if (cachedMask) {
      return cachedMask;
    }

    const zoneIndexes = new Uint8Array(FLAG_CANVAS_WIDTH * FLAG_CANVAS_HEIGHT);
    for (let pixelIndex = 0; pixelIndex < zoneIndexes.length; pixelIndex += 1) {
      const x = (pixelIndex % FLAG_CANVAS_WIDTH) / FLAG_CANVAS_WIDTH;
      const y = Math.floor(pixelIndex / FLAG_CANVAS_WIDTH) / FLAG_CANVAS_HEIGHT;
      zoneIndexes[pixelIndex] = this.findZoneAtPoint(pattern, x, y, zoneCount);
    }

    const pixelMask = {
      puzzleCode: cacheKey,
      width: FLAG_CANVAS_WIDTH,
      height: FLAG_CANVAS_HEIGHT,
      zoneIndexes,
    };
    this.patternMaskCache.set(cacheKey, pixelMask);
    return pixelMask;
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
      case 'center-disc':
        return ((x - 0.5) / 0.16) ** 2 + ((y - 0.5) / 0.24) ** 2 <= 1 ? 1 : 0;
      case 'horizontal-stripes-center-disc':
        if (((x - 0.5) / 0.127) ** 2 + ((y - 0.5) / 0.19) ** 2 <= 1) {
          return zoneCount - 1;
        }

        return Math.min(zoneCount - 2, Math.floor(y * (zoneCount - 1)));
      case 'saltire':
        if (Math.abs(y - x * 0.67) < 0.08 || Math.abs(y - (1 - x) * 0.67) < 0.08) {
          return 1;
        }

        return x < 0.2 || x > 0.8 ? 2 : 0;
      case 'diagonal-rays':
        return this.findDiagonalRayZoneAtPoint(x, y, zoneCount);
    }
  }

  private findDiagonalRayZoneAtPoint(x: number, y: number, zoneCount: number): number {
    const availableZones = Math.min(zoneCount, DIAGONAL_RAY_POLYGONS.length);
    const topProjection = x / Math.max(0.001, 1 - y);
    const thresholds = [0.24, 0.49, 0.76, 1];
    const matchingIndex = thresholds.findIndex((threshold) => topProjection <= threshold);

    return Math.min(availableZones - 1, matchingIndex >= 0 ? matchingIndex : availableZones - 1);
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

  private areColorsTooClose(left: string, right: string, minDistance: number): boolean {
    return this.computePerceptualDistance(left.toLowerCase(), right.toLowerCase()) < minDistance;
  }

  private rotateColor(color: string, offset: number): string | null {
    const rgb = this.hexToRgb(color);
    if (!rgb) {
      return null;
    }

    return this.rgbToHex({
      r: (rgb.r + offset + 256) % 256,
      g: (rgb.g + offset * 2 + 512) % 256,
      b: (rgb.b - offset + 256) % 256,
    });
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

  private rgbToHex(color: RgbColor): string {
    return `#${[color.r, color.g, color.b]
      .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
      .join('')}`;
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
