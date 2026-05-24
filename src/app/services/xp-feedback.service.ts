import { Injectable, OnDestroy, signal } from '@angular/core';
import { LevelTierId, buildLevelProgress } from './xp-progression';

export type XpFeedbackSnapshot = {
  xp: number;
  level: number;
};

export type XpFeedbackEvent = {
  id: number;
  amount: number;
  previousXp: number;
  nextXp: number;
  previousLevel: number;
  nextLevel: number;
  displayedXp: number;
  displayedLevel: number;
  displayedLevelTier: LevelTierId;
  displayedProgressPercent: number;
  reasonKey: string;
  leveledUp: boolean;
};

type PendingXpFeedback = Omit<
  XpFeedbackEvent,
  'id' | 'displayedXp' | 'displayedLevel' | 'displayedLevelTier' | 'displayedProgressPercent'
>;

const XP_FEEDBACK_DURATION_MS = 1100;
const XP_FEEDBACK_VISIBLE_MS = 4600;

@Injectable({ providedIn: 'root' })
export class XpFeedbackService implements OnDestroy {
  private readonly activeSignal = signal<XpFeedbackEvent | null>(null);
  private readonly queue: PendingXpFeedback[] = [];
  private readonly canUseWindow = typeof window !== 'undefined';
  private nextId = 1;
  private animationFrameId: number | null = null;
  private hideTimeoutId: number | null = null;

  readonly active = this.activeSignal.asReadonly();

  notifyProfileChange(
    previous: XpFeedbackSnapshot | null,
    next: XpFeedbackSnapshot,
    reasonKey = 'xpFeedback.reason.progress',
  ): void {
    if (!previous || next.xp <= previous.xp) {
      return;
    }

    this.enqueue({
      amount: next.xp - previous.xp,
      previousXp: previous.xp,
      nextXp: next.xp,
      previousLevel: previous.level,
      nextLevel: next.level,
      reasonKey,
      leveledUp: next.level > previous.level,
    });
  }

  dismiss(): void {
    this.clearCurrentTimers();
    this.activeSignal.set(null);
    this.startNext();
  }

  ngOnDestroy(): void {
    this.clearCurrentTimers();
  }

  private enqueue(feedback: PendingXpFeedback): void {
    if (this.activeSignal()) {
      this.queue.push(feedback);
      return;
    }

    this.start(feedback);
  }

  private start(feedback: PendingXpFeedback): void {
    this.clearCurrentTimers();

    const initialProgress = buildLevelProgress(feedback.previousXp);
    const event: XpFeedbackEvent = {
      ...feedback,
      id: this.nextId,
      displayedXp: feedback.previousXp,
      displayedLevel: initialProgress.level,
      displayedLevelTier: initialProgress.tier.id,
      displayedProgressPercent: initialProgress.progressPercent,
    };

    this.nextId += 1;
    this.activeSignal.set(event);

    if (!this.canUseWindow || this.prefersReducedMotion()) {
      this.setDisplayedXp(feedback.nextXp);
      this.scheduleDismiss();
      return;
    }

    const startedAt = window.performance.now();
    const tick = (now: number) => {
      const elapsedRatio = Math.min(1, (now - startedAt) / XP_FEEDBACK_DURATION_MS);
      const easedRatio = 1 - Math.pow(1 - elapsedRatio, 3);
      const displayedXp = Math.round(
        feedback.previousXp + (feedback.nextXp - feedback.previousXp) * easedRatio,
      );

      this.setDisplayedXp(displayedXp);

      if (elapsedRatio < 1) {
        this.animationFrameId = window.requestAnimationFrame(tick);
        return;
      }

      this.animationFrameId = null;
      this.scheduleDismiss();
    };

    this.animationFrameId = window.requestAnimationFrame(tick);
  }

  private startNext(): void {
    const next = this.queue.shift();
    if (next) {
      this.start(next);
    }
  }

  private setDisplayedXp(displayedXp: number): void {
    const current = this.activeSignal();
    if (!current) {
      return;
    }

    const progress = buildLevelProgress(displayedXp);
    this.activeSignal.set({
      ...current,
      displayedXp,
      displayedLevel: progress.level,
      displayedLevelTier: progress.tier.id,
      displayedProgressPercent: progress.progressPercent,
    });
  }

  private scheduleDismiss(): void {
    if (!this.canUseWindow) {
      return;
    }

    this.hideTimeoutId = window.setTimeout(() => this.dismiss(), XP_FEEDBACK_VISIBLE_MS);
  }

  private clearCurrentTimers(): void {
    if (!this.canUseWindow) {
      return;
    }

    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.hideTimeoutId !== null) {
      window.clearTimeout(this.hideTimeoutId);
      this.hideTimeoutId = null;
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      this.canUseWindow &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
