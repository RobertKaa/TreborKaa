import { TestBed } from '@angular/core/testing';
import { PersonalRecordsService } from './personal-records.service';

describe('PersonalRecordsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('stores a first result with computed percent', () => {
    const service = TestBed.inject(PersonalRecordsService);
    const record = service.saveResult('country-to-flag-easy', { score: 7, maxScore: 10 });

    expect(record.bestScore).toBe(7);
    expect(record.bestMaxScore).toBe(10);
    expect(record.bestPercent).toBe(70);
    expect(record.gamesPlayed).toBe(1);
  });

  it('keeps best score/percent when a worse result is saved', () => {
    const service = TestBed.inject(PersonalRecordsService);
    service.saveResult('country-to-flag-easy', { score: 8, maxScore: 10, streak: 6 });
    const record = service.saveResult('country-to-flag-easy', {
      score: 5,
      maxScore: 10,
      streak: 3,
    });

    expect(record.bestScore).toBe(8);
    expect(record.bestPercent).toBe(80);
    expect(record.gamesPlayed).toBe(2);
    expect(record.bestStreak).toBe(6);
  });

  it('merges remote records by keeping best values and latest play date', () => {
    const service = TestBed.inject(PersonalRecordsService);
    service.saveResult('flag-to-country-easy', { score: 7, maxScore: 10, streak: 4 });

    service.mergeRecords({
      'flag-to-country-easy': {
        bestScore: 9,
        bestMaxScore: 10,
        bestPercent: 90,
        gamesPlayed: 1,
        lastPlayedAt: '2999-01-01T00:00:00.000Z',
        bestStreak: 2,
      },
    });

    const record = service.getRecord('flag-to-country-easy');
    expect(record?.bestScore).toBe(9);
    expect(record?.gamesPlayed).toBe(1);
    expect(record?.bestStreak).toBe(4);
    expect(record?.lastPlayedAt).toBe('2999-01-01T00:00:00.000Z');
  });
});
