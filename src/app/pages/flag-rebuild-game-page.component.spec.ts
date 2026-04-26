import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagRebuildGamePageComponent } from './flag-rebuild-game-page.component';

describe('FlagRebuildGamePageComponent', () => {
  let fixture: ComponentFixture<FlagRebuildGamePageComponent>;
  let component: FlagRebuildGamePageComponent;

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
      imports: [FlagRebuildGamePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FlagRebuildGamePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('restarts game when closing summary', () => {
    (component as any).score.set(8);
    (component as any).errors.set([
      {
        puzzle: (component as any).allPuzzles[0],
        score: 42,
      },
    ]);
    (component as any).isComplete.set(true);

    (component as any).closeSummary();

    expect((component as any).isComplete()).toBe(false);
    expect((component as any).score()).toBe(0);
    expect((component as any).errors().length).toBe(0);
  });

  it('updates active piece color when hex input is valid', () => {
    (component as any).isLocked.set(false);
    (component as any).pieces.set([
      { id: 'zone-1', color: '#ffffff' },
      { id: 'zone-2', color: '#000000' },
    ]);
    (component as any).activeZoneIndex.set(0);

    (component as any).onHexColorInput('0f0');

    expect((component as any).pieces()[0].color).toBe('#00ff00');
    expect((component as any).activeHexColorInput()).toBe('#00FF00');
  });

  it('does not update piece color when hex input is invalid', () => {
    (component as any).isLocked.set(false);
    (component as any).pieces.set([{ id: 'zone-1', color: '#112233' }]);
    (component as any).activeZoneIndex.set(0);

    (component as any).onHexColorInput('xyz');

    expect((component as any).pieces()[0].color).toBe('#112233');
  });
});
