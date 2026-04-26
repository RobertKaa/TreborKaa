import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagRebuildBetaGameComponent } from './flag-rebuild-beta-game.component';

describe('FlagRebuildBetaGameComponent', () => {
  let fixture: ComponentFixture<FlagRebuildBetaGameComponent>;
  let component: FlagRebuildBetaGameComponent;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [FlagRebuildBetaGameComponent]
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
      puzzle.targetColors
    );

    expect(result.score).toBe(100);
    expect(result.colorScore).toBe(100);
  });

  it('keeps close colors highly scored without requiring exact values', () => {
    const puzzle = (component as any).currentPuzzle();
    const closeColors = puzzle.targetColors.map((color: string) =>
      color.toLowerCase() === '#ffffff' ? '#f7f7f7' : color
    );
    const result = (component as any).evaluatePuzzle(
      puzzle,
      puzzle.targetPattern,
      closeColors
    );

    expect(result.colorScore).toBeGreaterThanOrEqual(95);
  });

  it('penalizes the final score when the pattern is wrong', () => {
    const puzzle = (component as any).currentPuzzle();
    const wrongPattern = puzzle.patternOptions.find(
      (pattern: string) => pattern !== puzzle.targetPattern
    );

    if (!wrongPattern) {
      return;
    }

    const result = (component as any).evaluatePuzzle(
      puzzle,
      wrongPattern,
      puzzle.targetColors
    );

    expect(result.colorScore).toBe(100);
    expect(result.score).toBeLessThan(100);
  });
});
