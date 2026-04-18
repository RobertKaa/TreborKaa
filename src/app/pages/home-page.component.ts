import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAME_CATALOG, GameCatalogItem, GameId } from '../data/game-catalog';
import { FavoriteGamesService } from '../services/favorite-games.service';
import { GameProgressService } from '../services/game-progress.service';
import { I18nService } from '../services/i18n.service';
import { PersonalRecordsService } from '../services/personal-records.service';
import { PersonalRecord } from '../models/personal-record';

type HomeGameView = GameCatalogItem & {
  isFavorite: boolean;
  progressLabel: string | null;
  progressPercent: number | null;
  hasInProgress: boolean;
  bestRecord: PersonalRecord | null;
};

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css'
})
export class HomePageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly favoritesService = inject(FavoriteGamesService);
  private readonly progressService = inject(GameProgressService);
  private readonly recordsService = inject(PersonalRecordsService);
  protected readonly selectedTab = signal<'all' | 'favorites'>('all');

  protected readonly games = computed<HomeGameView[]>(() => {
    const favorites = this.favoritesService.snapshot();
    const records = this.recordsService.snapshot();
    const progress = this.progressService.snapshot();

    return GAME_CATALOG.map((item) => {
      const entry = progress[item.id] ?? null;
      const bestRecord = this.pickBestRecord(item.recordKeys.map((key) => records[key] ?? null));
      return {
        ...item,
        isFavorite: !!favorites[item.id],
        progressLabel: entry ? this.i18n.t(entry.labelKey, entry.labelParams) : null,
        progressPercent: entry ? entry.percent : null,
        hasInProgress: !!entry,
        bestRecord
      };
    });
  });
  protected readonly visibleGames = computed(() =>
    this.selectedTab() === 'favorites'
      ? this.games().filter((game) => game.isFavorite)
      : this.games()
  );

  protected setTab(tab: 'all' | 'favorites'): void {
    this.selectedTab.set(tab);
  }

  protected toggleFavorite(gameId: GameId): void {
    this.favoritesService.toggle(gameId);
  }

  protected favoriteAriaLabel(game: HomeGameView): string {
    return game.isFavorite ? this.i18n.t('home.favoriteRemove') : this.i18n.t('home.favoriteAdd');
  }

  protected recordLine(game: HomeGameView): string | null {
    const record = game.bestRecord;
    if (!record) {
      return null;
    }

    return this.i18n.t('home.bestRecord', {
      score: record.bestScore,
      percent: record.bestPercent
    });
  }

  private pickBestRecord(records: Array<PersonalRecord | null>): PersonalRecord | null {
    let best: PersonalRecord | null = null;

    for (const record of records) {
      if (!record) {
        continue;
      }

      if (
        !best ||
        record.bestPercent > best.bestPercent ||
        (record.bestPercent === best.bestPercent && record.bestScore > best.bestScore)
      ) {
        best = record;
      }
    }

    return best;
  }
}
