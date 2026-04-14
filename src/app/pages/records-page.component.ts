import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameRecordKey, PersonalRecord } from '../models/personal-record';
import { PersonalRecordsService } from '../services/personal-records.service';

type RecordTile = {
  key: GameRecordKey;
  label: string;
};

@Component({
  selector: 'app-records-page',
  imports: [RouterLink],
  templateUrl: './records-page.component.html',
  styleUrl: './records-page.component.css'
})
export class RecordsPageComponent {
  private readonly personalRecordsService = inject(PersonalRecordsService);

  protected readonly tiles: RecordTile[] = [
    { key: 'country-to-flag-easy', label: 'Classique P->D (Facile)' },
    { key: 'country-to-flag-hard', label: 'Classique P->D (Difficile)' },
    { key: 'flag-to-country-easy', label: 'Classique D->P (Facile)' },
    { key: 'flag-to-country-hard', label: 'Classique D->P (Difficile)' },
    { key: 'chrono-flags', label: 'Chrono drapeaux' },
    { key: 'find-the-error', label: "Trouver l'erreur" },
    { key: 'pixel-flag', label: 'Drapeau pixelise' },
    { key: 'flag-rebuild', label: 'Reconstruction de drapeau' }
  ];

  protected readonly rows = computed(() =>
    this.tiles
      .map((tile) => ({
        ...tile,
        record: this.personalRecordsService.getRecord(tile.key)
      }))
      .filter((row) => row.record !== null)
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
      key === 'flag-to-country-hard'
    ) {
      return `${record.bestScore} bonnes reponses`;
    }

    if (key === 'find-the-error' || key === 'flag-rebuild') {
      return `Serie max: ${record.bestScore}`;
    }

    if (key === 'chrono-flags') {
      const streak = record.bestStreak ? ` | meilleure serie x${record.bestStreak}` : '';
      return `Score ${record.bestScore} | precision ${record.bestPercent}%${streak}`;
    }

    return `${record.bestScore} / ${record.bestMaxScore} (${record.bestPercent}%)`;
  }

  protected formatLastPlayed(isoDate: string): string {
    return new Date(isoDate).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
