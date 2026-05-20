import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatSpeedrunTime } from '../models/speedrun';
import { I18nService } from '../services/i18n.service';
import {
  SpeedrunLeaderboardEntry,
  SpeedrunLeaderboardService,
} from '../services/speedrun-leaderboard.service';
import { SpeedrunRecordsService } from '../services/speedrun-records.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';

@Component({
  selector: 'app-speedrun-leaderboard-page',
  imports: [RouterLink],
  templateUrl: './speedrun-leaderboard-page.component.html',
  styleUrl: './speedrun-leaderboard-page.component.scss',
})
export class SpeedrunLeaderboardPageComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(SupabaseAuthService);
  protected readonly leaderboard = inject(SpeedrunLeaderboardService);
  private readonly records = inject(SpeedrunRecordsService);

  protected readonly bestRecord = computed(() => this.records.getBestForUser(this.auth.user()?.id));
  protected readonly isAuthenticated = this.auth.isAuthenticated;

  constructor() {
    void this.leaderboard.refresh();
  }

  protected formatTime(milliseconds: number): string {
    return formatSpeedrunTime(milliseconds);
  }

  protected rankLabel(index: number): string {
    return `#${index + 1}`;
  }

  protected displayInitials(entry: SpeedrunLeaderboardEntry): string {
    return entry.displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
