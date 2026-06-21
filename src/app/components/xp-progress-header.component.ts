import { Component, computed, inject } from '@angular/core';
import { AchievementsService } from '../services/achievements.service';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-xp-progress-header',
  template: `
    @if (isReady()) {
      <section
        class="xp-progress-header"
        [attr.aria-label]="i18n.t('gamification.headerProgressAria')"
      >
        <div
          class="xp-progress-crest"
          [attr.data-tier]="profile().levelTier"
          [attr.aria-label]="i18n.t('gamification.level', { level: profile().level })"
        >
          <strong>{{ profile().level }}</strong>
        </div>

        <div class="xp-progress-body">
          <div
            class="xp-progress-meter"
            role="progressbar"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="100"
            [attr.aria-valuenow]="profile().progressPercent"
            [attr.aria-label]="i18n.t('gamification.nextLevelProgress', {
              percent: profile().progressPercent
            })"
          >
            <span [style.width.%]="profile().progressPercent"></span>
          </div>

          <p class="xp-progress-goal">{{ nextLevelGoalLabel() }}</p>
        </div>
      </section>
    } @else {
      <section
        class="xp-progress-header xp-progress-header--loading"
        [attr.aria-busy]="true"
        [attr.aria-label]="i18n.t('gamification.headerProgressLoading')"
      >
        <div class="xp-progress-skeleton xp-progress-skeleton--badge" aria-hidden="true"></div>
        <div class="xp-progress-body">
          <div class="xp-progress-skeleton xp-progress-skeleton--meter" aria-hidden="true"></div>
          <div class="xp-progress-skeleton xp-progress-skeleton--goal" aria-hidden="true"></div>
        </div>
      </section>
    }
  `,
})
export class XpProgressHeaderComponent {
  protected readonly i18n = inject(I18nService);
  private readonly achievements = inject(AchievementsService);

  protected readonly isReady = this.achievements.xpProfileReady;
  protected readonly profile = this.achievements.profile;

  protected readonly nextLevelGoalLabel = computed(() => {
    const profile = this.profile();

    if (profile.nextLevelXp <= profile.currentLevelXp) {
      return this.i18n.t('gamification.maxLevelProgress');
    }

    const remaining = Math.max(0, profile.nextLevelXp - profile.xp);
    return this.i18n.t('gamification.xpToNextLevel', {
      remaining: this.formatNumber(remaining),
      level: profile.level + 1,
    });
  });

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat(this.i18n.locale()).format(Math.round(value));
  }
}
