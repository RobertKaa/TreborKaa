import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameRecordKey, PersonalRecord } from '../models/personal-record';
import { I18nService } from '../services/i18n.service';
import { PersonalRecordsService } from '../services/personal-records.service';

type RecordTile = {
  key: GameRecordKey;
};

@Component({
  selector: 'app-records-page',
  imports: [RouterLink],
  templateUrl: './records-page.component.html',
  styleUrl: './records-page.component.scss',
})
export class RecordsPageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly personalRecordsService = inject(PersonalRecordsService);

  protected readonly tiles: RecordTile[] = [
    { key: 'country-to-flag-easy' },
    { key: 'country-to-flag-hard' },
    { key: 'flag-to-country-easy' },
    { key: 'flag-to-country-hard' },
    { key: 'shape-to-country-easy' },
    { key: 'shape-to-country-hard' },
    { key: 'chrono-flags' },
    { key: 'flag-culture-easy' },
    { key: 'flag-culture-medium' },
    { key: 'flag-culture-hard' },
    { key: 'flag-culture-mixed' },
    { key: 'find-the-error' },
    { key: 'pixel-flag' },
    { key: 'flag-rebuild' },
    { key: 'flag-rebuild-beta' },
  ];

  protected readonly rows = computed(() =>
    this.tiles
      .map((tile) => ({
        ...tile,
        label: this.i18n.t(`records.tile.${tile.key}`),
        record: this.personalRecordsService.getRecord(tile.key),
      }))
      .filter((row) => row.record !== null),
  );

  protected readonly hasRecords = computed(() => this.rows().length > 0);

  protected clearAllRecords(): void {
    this.personalRecordsService.clearAll();
  }

  protected formatRecord(key: GameRecordKey, record: PersonalRecord): string {
    if (
      key === 'country-to-flag-easy' ||
      key === 'country-to-flag-hard' ||
      key === 'flag-to-country-easy' ||
      key === 'flag-to-country-hard' ||
      key === 'shape-to-country-easy' ||
      key === 'shape-to-country-hard'
    ) {
      return this.i18n.t('records.value.classic', { score: record.bestScore });
    }

    if (key === 'find-the-error' || key === 'flag-rebuild' || key === 'pixel-flag') {
      return this.i18n.t('records.value.streak', { score: record.bestScore });
    }

    if (key === 'flag-rebuild-beta') {
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

    return this.i18n.t('records.value.culture', {
      score: record.bestScore,
      max: record.bestMaxScore,
      percent: record.bestPercent,
    });
  }

  protected formatGamesPlayed(count: number): string {
    return this.i18n.t('records.gamesPlayed', { count });
  }

  protected formatLastPlayed(isoDate: string): string {
    const formatted = new Date(isoDate).toLocaleString(this.i18n.locale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.i18n.t('records.lastPlayed', { date: formatted });
  }
}
