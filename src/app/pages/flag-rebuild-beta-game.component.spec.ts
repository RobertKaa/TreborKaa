import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagRebuildBetaGameComponent } from './flag-rebuild-beta-game.component';

describe('FlagRebuildBetaGameComponent', () => {
  let fixture: ComponentFixture<FlagRebuildBetaGameComponent>;
  let component: FlagRebuildBetaGameComponent;

  beforeEach(async () => {
    localStorage.clear();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({
        beginPath: () => undefined,
        clearRect: () => undefined,
        closePath: () => undefined,
        createImageData: (width: number, height: number) => new ImageData(width, height),
        drawImage: () => undefined,
        fill: () => undefined,
        fillRect: () => undefined,
        getImageData: () => new ImageData(360, 240),
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
});
