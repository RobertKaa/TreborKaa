import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAME_CATALOG, GameCatalogItem, GameId } from '../data/game-catalog';
import { FavoriteGamesService } from '../services/favorite-games.service';
import { GameProgressService } from '../services/game-progress.service';
import { AchievementsService } from '../services/achievements.service';
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

type ClassicGameFamilyView = {
  id: 'country-to-flag' | 'flag-to-country' | 'shape-to-country';
  labelKey: string;
  descriptionKey: string;
  easy: HomeGameView;
  hard: HomeGameView;
  bestRecord: PersonalRecord | null;
};

const CLASSIC_FAMILIES: Array<{
  id: ClassicGameFamilyView['id'];
  labelKey: string;
  descriptionKey: string;
  easyId: GameId;
  hardId: GameId;
}> = [
  {
    id: 'country-to-flag',
    labelKey: 'home.classicCountryToFlag',
    descriptionKey: 'home.classicCountryToFlag.description',
    easyId: 'classic-country-to-flag-easy',
    hardId: 'classic-country-to-flag-hard',
  },
  {
    id: 'flag-to-country',
    labelKey: 'home.classicFlagToCountry',
    descriptionKey: 'home.classicFlagToCountry.description',
    easyId: 'classic-flag-to-country-easy',
    hardId: 'classic-flag-to-country-hard',
  },
  {
    id: 'shape-to-country',
    labelKey: 'home.classicShapeToCountry',
    descriptionKey: 'home.classicShapeToCountry.description',
    easyId: 'classic-shape-to-country-easy',
    hardId: 'classic-shape-to-country-hard',
  },
];

const CLASSIC_GAME_IDS = new Set<GameId>(
  CLASSIC_FAMILIES.flatMap((family) => [family.easyId, family.hardId]),
);

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly favoritesService = inject(FavoriteGamesService);
  private readonly progressService = inject(GameProgressService);
  private readonly recordsService = inject(PersonalRecordsService);
  private readonly achievementsService = inject(AchievementsService);
  protected readonly selectedTab = signal<'all' | 'favorites'>('all');
  protected readonly achievements = this.achievementsService.achievements;
  protected readonly profile = this.achievementsService.profile;
  protected readonly unlockedCount = this.achievementsService.unlockedCount;

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
        bestRecord,
      };
    });
  });
  protected readonly visibleGames = computed(() =>
    this.selectedTab() === 'favorites'
      ? this.games().filter((game) => game.isFavorite && !CLASSIC_GAME_IDS.has(game.id))
      : this.games().filter((game) => !CLASSIC_GAME_IDS.has(game.id)),
  );
  protected readonly visibleClassicFamilies = computed<ClassicGameFamilyView[]>(() => {
    const favoritesOnly = this.selectedTab() === 'favorites';
    const byId = new Map(this.games().map((game) => [game.id, game]));

    return CLASSIC_FAMILIES.map((family) => {
      const easy = byId.get(family.easyId);
      const hard = byId.get(family.hardId);
      if (!easy || !hard) {
        return null;
      }

      if (favoritesOnly && !easy.isFavorite && !hard.isFavorite) {
        return null;
      }

      return {
        id: family.id,
        labelKey: family.labelKey,
        descriptionKey: family.descriptionKey,
        easy,
        hard,
        bestRecord: this.pickBestRecord([easy.bestRecord, hard.bestRecord]),
      };
    }).filter((family): family is ClassicGameFamilyView => family !== null);
  });
  protected readonly displayedGamesCount = computed(
    () => this.visibleClassicFamilies().length + this.visibleGames().length,
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

  protected isClassicFavorite(family: ClassicGameFamilyView): boolean {
    return family.easy.isFavorite || family.hard.isFavorite;
  }

  protected toggleClassicFavorite(family: ClassicGameFamilyView): void {
    const nextValue = !this.isClassicFavorite(family);
    this.favoritesService.set(family.easy.id, nextValue);
    this.favoritesService.set(family.hard.id, nextValue);
  }

  protected classicFavoriteAriaLabel(family: ClassicGameFamilyView): string {
    return this.isClassicFavorite(family)
      ? this.i18n.t('home.favoriteRemove')
      : this.i18n.t('home.favoriteAdd');
  }

  protected recordLine(game: HomeGameView): string | null {
    const record = game.bestRecord;
    if (!record) {
      return null;
    }

    return this.i18n.t('home.bestRecord', {
      score: record.bestScore,
      percent: record.bestPercent,
    });
  }

  protected classicRecordLine(game: ClassicGameFamilyView): string | null {
    if (!game.bestRecord) {
      return null;
    }

    return this.i18n.t('home.bestRecord', {
      score: game.bestRecord.bestScore,
      percent: game.bestRecord.bestPercent,
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
