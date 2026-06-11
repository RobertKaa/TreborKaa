import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameRecordKey, PersonalRecord } from '../models/personal-record';
import { I18nService } from '../services/i18n.service';
import { PersonalRecordsService } from '../services/personal-records.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { UserDataSyncService } from '../services/user-data-sync.service';

type RecordTile = {
  key: GameRecordKey;
  route: string;
};

type RecordRow = RecordTile & {
  label: string;
  record: PersonalRecord;
};

@Component({
  selector: 'app-records-page',
  imports: [RouterLink],
  templateUrl: './records-page.component.html',
  styleUrl: './records-page.component.scss',
})
export class RecordsPageComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(SupabaseAuthService);
  private readonly personalRecordsService = inject(PersonalRecordsService);
  private readonly userDataSync = inject(UserDataSyncService);

  protected readonly resetDialogOpen = signal(false);
  protected readonly resetPending = signal(false);
  protected readonly resetError = signal<string | null>(null);

  protected readonly tiles: RecordTile[] = [
    { key: 'country-to-flag-easy', route: '/jeu/pays-vers-drapeaux' },
    { key: 'flag-to-country-easy', route: '/jeu/drapeaux-vers-pays' },
    { key: 'shape-to-country-easy', route: '/jeu/formes-vers-pays' },
    { key: 'chrono-flags', route: '/jeu/chrono-drapeaux' },
    { key: 'flag-rebuild', route: '/jeu/reconstruction-drapeau' },
    { key: 'find-the-error', route: '/jeu/trouver-erreur' },
    { key: 'pixel-flag', route: '/jeu/drapeau-pixelise' },
  ];

  protected readonly rows = computed<RecordRow[]>(() =>
    this.tiles.flatMap((tile) => {
      const record = this.personalRecordsService.getRecord(tile.key);
      return record
        ? [
            {
              ...tile,
              label: this.i18n.t(`records.tile.${tile.key}`),
              record,
            },
          ]
        : [];
    }),
  );

  protected readonly hasRecords = computed(() => this.rows().length > 0);
  protected readonly totalGames = computed(() =>
    this.rows().reduce((sum, row) => sum + row.record.gamesPlayed, 0),
  );
  protected readonly perfectRecordCount = computed(
    () => this.rows().filter((row) => row.record.bestPercent >= 100).length,
  );
  protected readonly bestStreak = computed(() =>
    this.rows().reduce((best, row) => Math.max(best, row.record.bestStreak ?? 0), 0),
  );
  protected readonly mostPlayedMode = computed(() =>
    this.rows().reduce<RecordRow | null>(
      (mostPlayed, row) =>
        !mostPlayed || row.record.gamesPlayed > mostPlayed.record.gamesPlayed ? row : mostPlayed,
      null,
    ),
  );
  protected readonly strongestMode = computed(() =>
    this.rows().reduce<RecordRow | null>((strongest, row) => {
      if (!strongest) {
        return row;
      }

      if (row.record.bestPercent !== strongest.record.bestPercent) {
        return row.record.bestPercent > strongest.record.bestPercent ? row : strongest;
      }

      return row.record.bestScore > strongest.record.bestScore ? row : strongest;
    }, null),
  );
  protected readonly nextChallenge = computed(() =>
    this.rows().reduce<RecordRow | null>(
      (challenge, row) =>
        !challenge || row.record.bestPercent < challenge.record.bestPercent ? row : challenge,
      null,
    ),
  );
  protected readonly nextChallengeTarget = computed(() => {
    const currentPercent = this.nextChallenge()?.record.bestPercent ?? 0;
    if (currentPercent >= 100) {
      return 100;
    }

    return Math.min(100, Math.max(currentPercent + 1, Math.ceil((currentPercent + 1) / 5) * 5));
  });

  protected openResetDialog(): void {
    this.resetError.set(null);
    this.resetDialogOpen.set(true);
  }

  protected closeResetDialog(): void {
    if (this.resetPending()) {
      return;
    }

    this.resetDialogOpen.set(false);
    this.resetError.set(null);
  }

  protected async confirmReset(): Promise<void> {
    if (this.resetPending()) {
      return;
    }

    this.resetPending.set(true);
    this.resetError.set(null);

    try {
      await this.userDataSync.clearPersonalRecords();
      this.resetDialogOpen.set(false);
    } catch {
      this.resetError.set(this.i18n.t('records.reset.error'));
    } finally {
      this.resetPending.set(false);
    }
  }

  protected formatRecord(key: GameRecordKey, record: PersonalRecord): string {
    if (
      key === 'country-to-flag-easy' ||
      key === 'flag-to-country-easy' ||
      key === 'shape-to-country-easy'
    ) {
      return this.i18n.t('records.value.classic', { score: record.bestScore });
    }

    if (key === 'find-the-error' || key === 'pixel-flag') {
      return this.i18n.t('records.value.streak', { score: record.bestScore });
    }

    if (key === 'flag-rebuild') {
      return this.i18n.t('records.value.points', { score: record.bestScore });
    }

    if (key === 'chrono-flags') {
      const streakSuffix = record.bestStreak
        ? this.i18n.t('records.value.chronoStreakSuffix', { streak: record.bestStreak })
        : '';
      return this.i18n.t('records.value.chrono', {
        score: record.bestScore,
        percent: record.bestPercent,
        streakSuffix,
      });
    }

    return this.i18n.t('records.value.points', { score: record.bestScore });
  }

  protected formatGamesPlayed(count: number): string {
    return this.i18n.t('records.gamesPlayed', { count });
  }

  protected formatLastPlayed(isoDate: string): string {
    const formatted = new Date(isoDate).toLocaleString(this.i18n.locale(), {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.i18n.t('records.lastPlayed', { date: formatted });
  }

  protected recordStatusKey(record: PersonalRecord): string {
    if (record.bestPercent >= 100) {
      return 'records.status.perfect';
    }

    if (record.bestPercent >= 90) {
      return 'records.status.excellent';
    }

    return 'records.status.toBeat';
  }
}
