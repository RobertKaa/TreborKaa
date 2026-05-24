import { TestBed } from '@angular/core/testing';
import { buildLevelProgress } from './xp-progression';
import { XpFeedbackService, XpFeedbackSnapshot } from './xp-feedback.service';

function snapshot(xp: number): XpFeedbackSnapshot {
  const progress = buildLevelProgress(xp);

  return {
    xp,
    level: progress.level,
  };
}

describe('XpFeedbackService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('starts a feedback event when profile XP increases', () => {
    const service = TestBed.inject(XpFeedbackService);

    service.notifyProfileChange(snapshot(900), snapshot(1180));

    const active = service.active();

    expect(active?.amount).toBe(280);
    expect(active?.previousXp).toBe(900);
    expect(active?.nextXp).toBe(1180);
    expect(active?.displayedXp).toBe(900);

    service.dismiss();
  });

  it('ignores initial, equal and lower XP snapshots', () => {
    const service = TestBed.inject(XpFeedbackService);

    service.notifyProfileChange(null, snapshot(900));
    service.notifyProfileChange(snapshot(900), snapshot(900));
    service.notifyProfileChange(snapshot(900), snapshot(700));

    expect(service.active()).toBeNull();
  });
});
