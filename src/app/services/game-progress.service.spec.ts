import { TestBed } from '@angular/core/testing';
import { GameProgressService } from './game-progress.service';

describe('GameProgressService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('saves progress with clamped percent and returns payload', () => {
    const service = TestBed.inject(GameProgressService);

    service.saveProgress(
      'flag-chrono',
      { score: 12 },
      { percent: 145, labelKey: 'home.resume.chrono' },
    );
    const entry = service.getProgress('flag-chrono');

    expect(entry).not.toBeNull();
    expect(entry?.percent).toBe(100);
    expect(service.getPayload<{ score: number }>('flag-chrono')?.score).toBe(12);
  });

  it('clears an existing progress entry', () => {
    const service = TestBed.inject(GameProgressService);
    service.saveProgress(
      'pixel-flag',
      { solved: 3 },
      { percent: 30, labelKey: 'home.resume.pixel' },
    );

    expect(service.getProgress('pixel-flag')).not.toBeNull();
    service.clearProgress('pixel-flag');
    expect(service.getProgress('pixel-flag')).toBeNull();
  });

  it('keeps the newest progress entry when merging remote data', () => {
    const service = TestBed.inject(GameProgressService);
    service.saveProgress(
      'pixel-flag',
      { solved: 1 },
      { percent: 10, labelKey: 'home.resume.pixel' },
    );
    const local = service.getProgress('pixel-flag')!;

    service.mergeProgress([
      {
        ...local,
        payload: { solved: 5 },
        percent: 50,
        updatedAt: '2999-01-01T00:00:00.000Z',
      },
      {
        gameId: 'flag-chrono',
        payload: { score: 20 },
        percent: 20,
        labelKey: 'home.resume.chrono',
        updatedAt: '2999-01-01T00:00:00.000Z',
      },
    ]);

    expect(service.getPayload<{ solved: number }>('pixel-flag')?.solved).toBe(5);
    expect(service.getProgress('flag-chrono')?.percent).toBe(20);
  });
});
