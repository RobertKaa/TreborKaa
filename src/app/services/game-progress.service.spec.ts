import { TestBed } from '@angular/core/testing';
import { GameProgressService } from './game-progress.service';

describe('GameProgressService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('saves progress with clamped percent and returns payload', () => {
    const service = TestBed.inject(GameProgressService);

    service.saveProgress('flag-chrono', { score: 12 }, { percent: 145, labelKey: 'home.resume.chrono' });
    const entry = service.getProgress('flag-chrono');

    expect(entry).not.toBeNull();
    expect(entry?.percent).toBe(100);
    expect(service.getPayload<{ score: number }>('flag-chrono')?.score).toBe(12);
  });

  it('clears an existing progress entry', () => {
    const service = TestBed.inject(GameProgressService);
    service.saveProgress('pixel-flag', { solved: 3 }, { percent: 30, labelKey: 'home.resume.pixel' });

    expect(service.getProgress('pixel-flag')).not.toBeNull();
    service.clearProgress('pixel-flag');
    expect(service.getProgress('pixel-flag')).toBeNull();
  });
});

