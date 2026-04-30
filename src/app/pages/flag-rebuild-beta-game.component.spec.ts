import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagRebuildBetaGameComponent } from './flag-rebuild-beta-game.component';

describe('FlagRebuildBetaGameComponent', () => {
  let fixture: ComponentFixture<FlagRebuildBetaGameComponent>;
  let component: FlagRebuildBetaGameComponent;
  const createMockImageData = (width: number, height: number): ImageData =>
    ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    }) as ImageData;

  beforeEach(async () => {
    localStorage.clear();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({
        arc: () => undefined,
        beginPath: () => undefined,
        clearRect: () => undefined,
        closePath: () => undefined,
        createImageData: createMockImageData,
        drawImage: () => undefined,
        fill: () => undefined,
        fillRect: () => undefined,
        getImageData: () => createMockImageData(360, 240),
        lineTo: () => undefined,
        moveTo: () => undefined,
        putImageData: () => undefined,
        restore: () => undefined,
        save: () => undefined,
        stroke: () => undefined,
        strokeRect: () => undefined,
        set fillStyle(_value: string) {},
        set lineWidth(_value: number) {},
        set shadowBlur(_value: number) {},
        set shadowColor(_value: string) {},
        set strokeStyle(_value: string) {},
      }),
    });

    await TestBed.configureTestingModule({
      imports: [FlagRebuildBetaGameComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FlagRebuildBetaGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('scores exact target colors at 100 percent when the pattern matches', () => {
    const puzzle = (component as any).currentPuzzle();
    const result = (component as any).evaluatePuzzle(
      puzzle,
      puzzle.targetPattern,
      puzzle.targetColors,
      false,
    );

    return result.then((evaluation: any) => {
      expect(evaluation.score).toBe(100);
      expect(evaluation.colorScore).toBe(100);
      expect(evaluation.points).toBe(100);
    });
  });

  it('keeps close colors highly scored without requiring exact values', () => {
    const puzzle = (component as any).currentPuzzle();
    const closeColors = puzzle.targetColors.map((color: string) =>
      color.toLowerCase() === '#ffffff' ? '#f7f7f7' : color,
    );
    const result = (component as any).evaluatePuzzle(
      puzzle,
      puzzle.targetPattern,
      closeColors,
      false,
    );

    return result.then((evaluation: any) => {
      expect(evaluation.colorScore).toBeGreaterThanOrEqual(95);
    });
  });

  it('penalizes the final score when the pattern is wrong', () => {
    const puzzle = (component as any).currentPuzzle();
    const wrongPattern = puzzle.patternOptions.find(
      (pattern: string) => pattern !== puzzle.targetPattern,
    );

    if (!wrongPattern) {
      return;
    }

    const result = (component as any).evaluatePuzzle(
      puzzle,
      wrongPattern,
      puzzle.targetColors,
      false,
    );

    return result.then((evaluation: any) => {
      expect(evaluation.colorScore).toBe(100);
      expect(evaluation.score).toBeLessThan(100);
    });
  });

  it('offers four shuffled shape choices with the correct shape included', () => {
    const puzzle = (component as any).currentPuzzle();
    const choices = (component as any).buildPatternChoices(puzzle);

    expect(choices.length).toBe(4);
    expect(choices.some((choice: any) => choice.pattern === puzzle.targetPattern)).toBe(true);
    expect(new Set(choices.map((choice: any) => choice.pattern)).size).toBe(choices.length);
  });

  it('starts a 15 flag run without duplicate countries', () => {
    const runPuzzles = (component as any).runPuzzles();
    const countryCodes = runPuzzles.map((puzzle: any) => puzzle.code);

    expect(runPuzzles.length).toBe(15);
    expect(new Set(countryCodes).size).toBe(15);
    expect((component as any).currentPuzzle().code).toBe(runPuzzles[0].code);
  });

  it('selects the first shape choice by default', () => {
    const firstChoice = (component as any).patternChoices()[0];

    expect((component as any).hasChosenPattern()).toBe(true);
    expect((component as any).selectedPattern()).toBe(firstChoice.pattern);
  });

  it('keeps shape choices visually diverse across pattern families', () => {
    const puzzle = {
      code: 'cl',
      nameFrench: 'Chili',
      targetPattern: 'canton-horizontal-bands',
      patternOptions: ['canton-horizontal-bands', 'horizontal-stripes', 'left-band-horizontal'],
      targetColors: ['#0039a6', '#ffffff', '#d52b1e'],
      palette: [],
      flagUrl: 'https://flagcdn.com/w320/cl.png',
    };
    const choices = (component as any).buildPatternChoices(puzzle);
    const families = new Set(
      choices.map((choice: any) => (component as any).getPatternFamily(choice.pattern)),
    );

    expect(choices.length).toBe(4);
    expect(choices.some((choice: any) => choice.pattern === 'canton-horizontal-bands')).toBe(true);
    expect(families.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps exact colors in a mixed beta palette', () => {
    const puzzle = (component as any).currentPuzzle();
    const palette = (component as any).buildPaletteOptions(puzzle);
    const targetColors = Array.from(new Set(puzzle.targetColors));

    puzzle.targetColors.forEach((color: string) => {
      expect(palette).toContain(color);
    });
    expect(palette.length).toBeGreaterThan(targetColors.length);
  });

  it('keeps beta palette decoys distinct from target colors', () => {
    const puzzle = {
      code: 'fr',
      nameFrench: 'France',
      targetPattern: 'vertical-stripes',
      patternOptions: ['vertical-stripes', 'horizontal-stripes'],
      targetColors: ['#0055a4', '#ffffff', '#ef4135'],
      palette: ['#0055a4', '#f8f8f8', '#ef4135', '#0060ad', '#1f6ac7', '#22aa55'],
      flagUrl: 'https://flagcdn.com/w320/fr.png',
    };
    const palette = (component as any).buildPaletteOptions(puzzle);
    const targetColors = Array.from(new Set(puzzle.targetColors));
    const decoys = palette.filter((color: string) => !targetColors.includes(color));

    expect(palette.length).toBeGreaterThanOrEqual(8);
    decoys.forEach((color: string) => {
      expect(
        targetColors.some((targetColor: string) =>
          (component as any).areColorsTooClose(color, targetColor, 30),
        ),
      ).toBe(false);
    });
  });

  it('does not stack the same round points after validation', async () => {
    const puzzle = (component as any).currentPuzzle();
    (component as any).selectedPattern.set(puzzle.targetPattern);
    (component as any).hasChosenPattern.set(true);
    (component as any).pieces.set(
      puzzle.targetColors.map((color: string, index: number) => ({
        id: `filled-${index}`,
        color,
      })),
    );
    (component as any).evaluatePuzzle = () =>
      Promise.resolve({
        score: 80,
        colorScore: 80,
        imageScore: 80,
        patternScore: 100,
        zoneScores: [80],
        labelKey: 'classic.rebuild.beta.rank.close',
      });

    await (component as any).submitRound();
    await (component as any).submitRound();

    expect((component as any).totalScore()).toBe(85);
    expect((component as any).completedRounds()).toBe(1);
  });

  it('locks the round after validation', async () => {
    const puzzle = (component as any).currentPuzzle();
    (component as any).selectedPattern.set(puzzle.targetPattern);
    (component as any).hasChosenPattern.set(true);
    (component as any).pieces.set(
      puzzle.targetColors.map((color: string, index: number) => ({
        id: `filled-${index}`,
        color,
      })),
    );
    (component as any).evaluatePuzzle = () =>
      Promise.resolve({
        score: 88,
        colorScore: 88,
        imageScore: 88,
        patternScore: 100,
        zoneScores: [88],
        labelKey: 'classic.rebuild.beta.rank.close',
      });

    await (component as any).submitRound();

    expect((component as any).currentStreak()).toBe(1);
    expect((component as any).bestStreak()).toBe(1);

    const lockedPieces = (component as any).pieces();
    (component as any).selectColor('#111111');
    (component as any).selectPattern('vertical-stripes');

    expect((component as any).pieces()).toEqual(lockedPieces);
    expect((component as any).selectedPattern()).toBe(puzzle.targetPattern);
  });

  it('adds gamified bonus points for streak and precision', () => {
    const result = (component as any).addGamifiedPoints({
      score: 92,
      points: 92,
      colorScore: 92,
      imageScore: 92,
      patternScore: 100,
      zoneScores: [92, 94],
      labelKey: 'classic.rebuild.beta.rank.perfect',
    });

    expect(result.points).toBe(122);
  });

  it('builds gamified result feedback from score details', () => {
    const result = {
      score: 91,
      colorScore: 91,
      imageScore: 89,
      patternScore: 100,
      zoneScores: [82, 94, 88],
      labelKey: 'classic.rebuild.beta.rank.close',
    };

    expect((component as any).buildResultBadges(result, 2)).toEqual([
      'classic.rebuild.beta.badge.structure',
      'classic.rebuild.beta.badge.precision',
      'classic.rebuild.beta.badge.zones',
      'classic.rebuild.beta.badge.streak',
    ]);
    expect((component as any).getResultTipLabelKey(result)).toBe('classic.rebuild.beta.tip.close');
    expect((component as any).computeAverageScore(result.zoneScores)).toBe(88);
  });

  it('explains when the selected shape limits the score', () => {
    const result = {
      score: 58,
      colorScore: 100,
      imageScore: 100,
      patternScore: 58,
      zoneScores: [100, 100, 100],
      labelKey: 'classic.rebuild.beta.rank.warm',
    };

    expect((component as any).getResultTipLabelKey(result)).toBe('classic.rebuild.beta.tip.shape');
  });

  it('moves to the next empty zone after selecting a color', () => {
    (component as any).hasChosenPattern.set(true);
    (component as any).pieces.set([
      { id: 'zone-1', color: '#f7f3ea' },
      { id: 'zone-2', color: '#f7f3ea' },
      { id: 'zone-3', color: '#f7f3ea' },
    ]);
    (component as any).selectedPattern.set('horizontal-stripes');
    (component as any).selectedZoneIndex.set(0);

    (component as any).selectColor('#111111');

    expect((component as any).pieces()[0].color).toBe('#111111');
    expect((component as any).selectedZoneIndex()).toBe(1);
  });

  it('keeps the first shape selected before painting', () => {
    expect((component as any).isReadyToValidate()).toBe(false);

    const firstChoice = (component as any).patternChoices()[0];

    expect((component as any).hasChosenPattern()).toBe(true);
    expect((component as any).selectedPattern()).toBe(firstChoice.pattern);

    (component as any).selectColor('#111111');

    expect((component as any).pieces()[0].color).toBe('#111111');
    expect((component as any).isReadyToValidate()).toBe(false);
  });

  it('keeps validation manual after the last zone is filled', async () => {
    (component as any).currentPuzzle.set({
      code: 'xx',
      nameFrench: 'Test',
      targetPattern: 'horizontal-stripes',
      patternOptions: ['horizontal-stripes', 'vertical-stripes'],
      targetColors: ['#222222', '#111111'],
      palette: ['#222222', '#111111'],
      flagUrl: 'https://flagcdn.com/w320/fr.png',
    });
    (component as any).selectedPattern.set('horizontal-stripes');
    (component as any).hasChosenPattern.set(true);
    (component as any).pieces.set([
      { id: 'zone-1', color: '#222222' },
      { id: 'zone-2', color: '#f7f3ea' },
    ]);
    (component as any).selectedZoneIndex.set(1);
    (component as any).evaluatePuzzle = () =>
      Promise.resolve({
        score: 76,
        points: 76,
        colorScore: 76,
        imageScore: 76,
        patternScore: 100,
        zoneScores: [76],
        labelKey: 'classic.rebuild.beta.rank.close',
      });

    (component as any).selectColor('#111111');
    await Promise.resolve();

    expect((component as any).result()).toBeNull();
    expect((component as any).totalScore()).toBe(0);
    expect((component as any).isReadyToValidate()).toBe(true);

    await (component as any).submitRound();

    expect((component as any).result()?.score).toBe(76);
    expect((component as any).totalScore()).toBe(81);
  });

  it('renders a compact progress result modal without retry or score details', async () => {
    const puzzle = (component as any).currentPuzzle();
    (component as any).selectedPattern.set(puzzle.targetPattern);
    (component as any).hasChosenPattern.set(true);
    (component as any).pieces.set(
      puzzle.targetColors.map((color: string, index: number) => ({
        id: `filled-${index}`,
        color,
      })),
    );
    (component as any).evaluatePuzzle = () =>
      Promise.resolve({
        score: 80,
        colorScore: 80,
        imageScore: 80,
        patternScore: 100,
        zoneScores: [80],
        labelKey: 'classic.rebuild.beta.rank.close',
      });

    await (component as any).submitRound();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.result-modal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.result-modal.result-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.result-modal .summary-score')).toBeNull();
    expect(fixture.nativeElement.querySelector('.result-modal .zone-score-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('.result-run-progress')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Retenter');
    expect(fixture.nativeElement.textContent).not.toContain('80%');
  });

  it('does not render the removed step tracker', () => {
    expect(fixture.nativeElement.querySelector('.flow-panel')).toBeNull();
  });

  it('keeps mission and shape choices inside the playable grid', () => {
    const boardGrid = fixture.nativeElement.querySelector('.beta-board-grid');

    expect(boardGrid.querySelector('.beta-setup-card .mission-panel')).not.toBeNull();
    expect(boardGrid.querySelector('.beta-setup-card .visual-choice-panel')).not.toBeNull();
  });

  it('keeps shape and color choices visually compact', () => {
    expect(fixture.nativeElement.querySelector('.pattern-choice-card span')).toBeNull();
    expect(fixture.nativeElement.querySelector('.palette-token')).toBeNull();
  });

  it('keeps diagonal rays as five selectable zones', () => {
    expect((component as any).getPatternZoneCount('diagonal-rays', 2)).toBe(5);

    expect((component as any).findZoneAtPoint('diagonal-rays', 0.1, 0.05, 5)).toBe(0);
    expect((component as any).findZoneAtPoint('diagonal-rays', 0.36, 0.05, 5)).toBe(1);
    expect((component as any).findZoneAtPoint('diagonal-rays', 0.62, 0.05, 5)).toBe(2);
    expect((component as any).findZoneAtPoint('diagonal-rays', 0.88, 0.05, 5)).toBe(3);
    expect((component as any).findZoneAtPoint('diagonal-rays', 0.95, 0.7, 5)).toBe(4);
  });

  it('supports canton plus horizontal bands as a selectable shape', () => {
    expect((component as any).getPatternZoneCount('canton-horizontal-bands', 3)).toBe(3);
    expect((component as any).findZoneAtPoint('canton-horizontal-bands', 0.1, 0.1, 3)).toBe(0);
    expect((component as any).findZoneAtPoint('canton-horizontal-bands', 0.6, 0.1, 3)).toBe(1);
    expect((component as any).findZoneAtPoint('canton-horizontal-bands', 0.6, 0.8, 3)).toBe(2);
  });

  it('builds the same pixel mask renderer for wrong shape choices', () => {
    (component as any).selectedPattern.set('triangle-left-bands-3');
    (component as any).pieces.set([
      { id: 'zone-1', color: '#111111' },
      { id: 'zone-2', color: '#222222' },
      { id: 'zone-3', color: '#333333' },
      { id: 'zone-4', color: '#444444' },
    ]);

    const mask = (component as any).getActivePatternPixelMask();

    expect(mask.width).toBe(360);
    expect(mask.height).toBe(240);
    expect(new Set(Array.from(mask.zoneIndexes)).size).toBe(4);
  });

  it('can score a real-pixel mask perfectly with exact zone colors', () => {
    const pixelMask = {
      puzzleCode: 'test',
      width: 2,
      height: 2,
      zoneIndexes: new Uint8Array([0, 1, 1, 0]),
    };

    expect(
      (component as any).computePixelMaskScore(
        pixelMask,
        ['#0057b7', '#ffd700'],
        ['#0057b7', '#ffd700'],
      ),
    ).toBe(100);
  });

  it('selects zones directly from the real-pixel mask', () => {
    const pixelMask = {
      puzzleCode: 'test',
      width: 2,
      height: 2,
      zoneIndexes: new Uint8Array([0, 1, 1, 0]),
    };

    expect((component as any).findPixelMaskZoneAtPoint(pixelMask, 0.75, 0.25)).toBe(1);
    expect((component as any).findPixelMaskZoneAtPoint(pixelMask, 0.75, 0.75)).toBe(0);
  });

  it('keeps guide pixels clamped inside the canvas', () => {
    const calls: number[][] = [];
    const context = {
      fillRect: (...args: number[]) => calls.push(args),
    };

    (component as any).fillGuidePixel(context, 0, 0, 5, 10, 10);
    (component as any).fillGuidePixel(context, 9, 9, 5, 10, 10);

    expect(calls).toEqual([
      [0, 0, 5, 5],
      [7, 7, 3, 3],
    ]);
  });

  it('keeps repeated stripe colors as separate real-pixel zones', () => {
    const imageData = {
      width: 4,
      height: 6,
      data: new Uint8ClampedArray(4 * 6 * 4),
    } as ImageData;
    const stripeColors = [
      [0xa5, 0x19, 0x31],
      [0xf4, 0xf5, 0xf8],
      [0x2d, 0x2a, 0x4a],
      [0xf4, 0xf5, 0xf8],
      [0xa5, 0x19, 0x31],
    ];
    const stripeByRow = [0, 1, 2, 2, 3, 4];

    stripeByRow.forEach((stripeIndex, y) => {
      for (let x = 0; x < imageData.width; x += 1) {
        const dataIndex = (y * imageData.width + x) * 4;
        imageData.data[dataIndex] = stripeColors[stripeIndex][0];
        imageData.data[dataIndex + 1] = stripeColors[stripeIndex][1];
        imageData.data[dataIndex + 2] = stripeColors[stripeIndex][2];
        imageData.data[dataIndex + 3] = 255;
      }
    });

    const zoneIndexes = (component as any).createOrderedStripeZoneIndexes(
      imageData,
      ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'],
      'y',
    );

    expect(Array.from(zoneIndexes)).toEqual(stripeByRow);
  });

  it('keeps repeated triangle-band colors as separate real-pixel zones', () => {
    const imageData = {
      width: 8,
      height: 6,
      data: new Uint8ClampedArray(8 * 6 * 4),
    } as ImageData;
    const colors = {
      triangle: [0x00, 0x00, 0x00],
      cyan: [0x00, 0xab, 0xc9],
      yellow: [0xfa, 0xe0, 0x42],
    };

    for (let y = 0; y < imageData.height; y += 1) {
      for (let x = 0; x < imageData.width; x += 1) {
        const isTriangle = x <= 3 - Math.abs(y - 2.5);
        const stripeColor = y < 2 ? colors.cyan : y < 4 ? colors.yellow : colors.cyan;
        const color = isTriangle ? colors.triangle : stripeColor;
        const dataIndex = (y * imageData.width + x) * 4;
        imageData.data[dataIndex] = color[0];
        imageData.data[dataIndex + 1] = color[1];
        imageData.data[dataIndex + 2] = color[2];
        imageData.data[dataIndex + 3] = 255;
      }
    }

    const zoneIndexes = (component as any).createTriangleBandZoneIndexes(imageData, [
      '#000000',
      '#00abc9',
      '#fae042',
      '#00abc9',
    ]);

    expect(zoneIndexes[7]).toBe(1);
    expect(zoneIndexes[2 * imageData.width + 7]).toBe(2);
    expect(zoneIndexes[5 * imageData.width + 7]).toBe(3);
    expect(zoneIndexes[2 * imageData.width]).toBe(0);
  });

  it('builds geometric real-pixel zones for canton plus horizontal bands', () => {
    const imageData = {
      width: 6,
      height: 4,
      data: new Uint8ClampedArray(6 * 4 * 4),
    } as ImageData;

    const zoneIndexes = (component as any).createCantonHorizontalBandZoneIndexes(imageData);

    expect(zoneIndexes[0]).toBe(0);
    expect(zoneIndexes[4]).toBe(1);
    expect(zoneIndexes[3 * imageData.width + 4]).toBe(2);
  });
});
