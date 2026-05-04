import { Component, inject } from '@angular/core';
import { AchievementsService } from '../services/achievements.service';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-achievements-page',
  templateUrl: './achievements-page.component.html',
  styleUrl: './achievements-page.component.scss',
})
export class AchievementsPageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly achievementsService = inject(AchievementsService);

  protected readonly achievements = this.achievementsService.achievements;
  protected readonly unlockedCount = this.achievementsService.unlockedCount;
  protected readonly profile = this.achievementsService.profile;
}
