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
        drawImage: () => undefined,
        fill: () => undefined,
        fillRect: () => undefined,
        getImageData: () => new ImageData(360, 240),
        lineTo: () => undefined,
        moveTo: () => undefined,
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
});
