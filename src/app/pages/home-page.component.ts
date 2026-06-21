import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAME_CATALOG, GameCatalogItem, GameId } from '../data/game-catalog';
import { GameProgressService } from '../services/game-progress.service';
import { AchievementsService } from '../services/achievements.service';
import { DailyChallengeService } from '../services/daily-challenge.service';
import { I18nService } from '../services/i18n.service';
import { PersonalRecordsService } from '../services/personal-records.service';
import { SpeedrunLeaderboardService } from '../services/speedrun-leaderboard.service';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { type GameRecordKey, type PersonalRecord } from '../models/personal-record';

type HomeGameView = GameCatalogItem & {
  progressLabel: string | null;
  progressPercent: number | null;
  hasInProgress: boolean;
  bestRecord: PersonalRecord | null;
};

type ClassicGameFamilyView = {
  id: 'country-to-flag' | 'flag-to-country' | 'shape-to-country' | 'capital-to-country';
  labelKey: string;
  descriptionKey: string;
  game: HomeGameView;
  bestRecord: PersonalRecord | null;
};

type HomeSearchSuggestion = {
  id: string;
  label: string;
  description: string;
  route: string[];
};

type ProgressStats = {
  gamesPlayed: number;
  averageAccuracy: number | null;
};

const CLASSIC_FAMILIES: Array<{
  id: ClassicGameFamilyView['id'];
  labelKey: string;
  descriptionKey: string;
  gameId: GameId;
}> = [
  {
    id: 'country-to-flag',
    labelKey: 'home.classicCountryToFlag',
    descriptionKey: 'home.classicCountryToFlag.description',
    gameId: 'classic-country-to-flag-easy',
  },
  {
    id: 'flag-to-country',
    labelKey: 'home.classicFlagToCountry',
    descriptionKey: 'home.classicFlagToCountry.description',
    gameId: 'classic-flag-to-country-easy',
  },
  {
    id: 'shape-to-country',
    labelKey: 'home.classicShapeToCountry',
    descriptionKey: 'home.classicShapeToCountry.description',
    gameId: 'classic-shape-to-country-easy',
  },
  {
    id: 'capital-to-country',
    labelKey: 'home.classicCapitalToCountry',
    descriptionKey: 'home.classicCapitalToCountry.description',
    gameId: 'classic-capital-to-country-easy',
  },
];

const CLASSIC_GAME_IDS = new Set<GameId>(CLASSIC_FAMILIES.map((family) => family.gameId));
const AVAILABLE_RECORD_KEYS = new Set<GameRecordKey>(
  GAME_CATALOG.filter((game) => game.available).flatMap((game) => game.recordKeys),
);
const PRIMARY_GAME_ORDER: GameId[] = ['flag-chrono', 'flag-rebuild'];

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly progressService = inject(GameProgressService);
  private readonly recordsService = inject(PersonalRecordsService);
  private readonly achievementsService = inject(AchievementsService);
  private readonly dailyChallengeService = inject(DailyChallengeService);
  private readonly leaderboardService = inject(SpeedrunLeaderboardService);
  private readonly auth = inject(SupabaseAuthService);
  protected readonly homeSearch = signal('');
  protected readonly achievements = this.achievementsService.achievements;
  protected readonly profile = this.achievementsService.profile;
  protected readonly unlockedCount = this.achievementsService.unlockedCount;
  protected readonly progressStats = computed<ProgressStats>(() => {
    const records = Object.entries(this.recordsService.snapshot()).filter(
      (entry): entry is [GameRecordKey, PersonalRecord] =>
        AVAILABLE_RECORD_KEYS.has(entry[0] as GameRecordKey) && !!entry[1],
    );
    const gamesPlayed = records.reduce((sum, [, record]) => sum + record.gamesPlayed, 0);
    const averageAccuracy =
      records.length > 0
        ? Math.round(
            records.reduce((sum, [, record]) => sum + record.bestPercent, 0) / records.length,
          )
        : null;

    return {
      gamesPlayed,
      averageAccuracy,
    };
  });
  protected readonly progressAccuracyLabel = computed(() => {
    const accuracy = this.progressStats().averageAccuracy;
    return accuracy === null ? this.i18n.t('common.none') : `${accuracy}%`;
  });
  protected readonly levelXpProgressLabel = computed(() => {
    const profile = this.profile();
    const currentLevelXp = Math.max(0, profile.xp - profile.currentLevelXp);
    const requiredLevelXp = Math.max(0, profile.nextLevelXp - profile.currentLevelXp);

    if (requiredLevelXp === 0) {
      return this.i18n.t('gamification.maxLevelProgress');
    }

    return this.i18n.t('gamification.levelXpProgress', {
      current: this.formatNumber(currentLevelXp),
      required: this.formatNumber(requiredLevelXp),
    });
  });
  protected readonly games = computed<HomeGameView[]>(() => {
    const records = this.recordsService.snapshot();
    const progress = this.progressService.snapshot();

    return GAME_CATALOG.map((item) => {
      const entry = progress[item.id] ?? null;
      const bestRecord = this.pickBestRecord(item.recordKeys.map((key) => records[key] ?? null));
      return {
        ...item,
        progressLabel: entry ? this.i18n.t(entry.labelKey, entry.labelParams) : null,
        progressPercent: entry ? entry.percent : null,
        hasInProgress: !!entry,
        bestRecord,
      };
    });
  });
  protected readonly visibleGames = computed(() =>
    this.sortDashboardGames(
      this.games().filter(
        (game) => !CLASSIC_GAME_IDS.has(game.id) && PRIMARY_GAME_ORDER.includes(game.id),
      ),
    ),
  );
  protected readonly hiddenGames = computed(() =>
    this.sortHiddenGames(
      this.games().filter(
        (game) => !CLASSIC_GAME_IDS.has(game.id) && !PRIMARY_GAME_ORDER.includes(game.id),
      ),
    ),
  );
  protected readonly displayedSecondaryGames = computed(() => [
    ...this.visibleGames(),
    ...this.hiddenGames(),
  ]);
  protected readonly visibleClassicFamilies = computed<ClassicGameFamilyView[]>(() => {
    const byId = new Map(this.games().map((game) => [game.id, game]));

    return CLASSIC_FAMILIES.map((family) => {
      const game = byId.get(family.gameId);
      if (!game) {
        return null;
      }

      return {
        id: family.id,
        labelKey: family.labelKey,
        descriptionKey: family.descriptionKey,
        game,
        bestRecord: game.bestRecord,
      };
    }).filter((family): family is ClassicGameFamilyView => family !== null);
  });
  protected readonly displayedGamesCount = computed(
    () => this.visibleClassicFamilies().length + this.displayedSecondaryGames().length,
  );
  protected readonly hasDisplayedGames = computed(() => this.displayedGamesCount() > 0);
  protected readonly dailyChallenge = this.dailyChallengeService.today;
  protected readonly speedrunRankLabel = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return '-';
    }

    const rank = this.leaderboardService.entries().findIndex((entry) => entry.userId === userId);

    return rank === -1 ? '-' : `#${rank + 1}`;
  });
  protected readonly searchSuggestions = computed<HomeSearchSuggestion[]>(() => {
    const search = this.normalizeForSearch(this.homeSearch());
    if (search.length === 0) {
      return [];
    }

    return this.searchableGames()
      .filter((suggestion) =>
        this.normalizeForSearch(`${suggestion.label} ${suggestion.description}`).includes(search),
      )
      .slice(0, 6);
  });

  constructor() {
    void this.leaderboardService.refresh(100);
  }

  protected setHomeSearch(value: string): void {
    this.homeSearch.set(value);
  }

  protected clearHomeSearch(): void {
    this.homeSearch.set('');
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

  private sortDashboardGames(games: HomeGameView[]): HomeGameView[] {
    return [...games].sort(
      (left, right) => this.dashboardGameOrder(left.id) - this.dashboardGameOrder(right.id),
    );
  }

  private sortHiddenGames(games: HomeGameView[]): HomeGameView[] {
    return [...games].sort((left, right) =>
      this.i18n.t(left.labelKey).localeCompare(this.i18n.t(right.labelKey)),
    );
  }

  private dashboardGameOrder(id: GameId): number {
    const index = PRIMARY_GAME_ORDER.indexOf(id);
    return index === -1 ? PRIMARY_GAME_ORDER.length : index;
  }

  private searchableGames(): HomeSearchSuggestion[] {
    const byId = new Map(this.games().map((game) => [game.id, game]));
    const classicSuggestions = CLASSIC_FAMILIES.flatMap((family) => {
      const game = byId.get(family.gameId);
      if (!game?.available) {
        return [];
      }

      return [
        {
          id: family.id,
          label: this.i18n.t(family.labelKey),
          description: this.i18n.t(family.descriptionKey),
          route: game.route,
        },
      ];
    });
    const gameSuggestions = this.games()
      .filter((game) => !CLASSIC_GAME_IDS.has(game.id) && game.available)
      .map((game) => ({
        id: game.id,
        label: this.i18n.t(game.labelKey),
        description: this.i18n.t(game.descriptionKey),
        route: game.route,
      }));

    return [
      ...classicSuggestions,
      ...gameSuggestions,
      {
        id: 'daily-challenge',
        label: this.i18n.t('daily.title'),
        description: this.i18n.t('daily.intro'),
        route: ['/defi-du-jour'],
      },
      {
        id: 'speedrun',
        label: this.i18n.t('speedrun.homeTitle'),
        description: this.i18n.t('speedrun.homeIntro'),
        route: ['/speedrun'],
      },
    ];
  }

  private normalizeForSearch(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 0 }).format(
      Math.max(0, Math.round(value)),
    );
  }
}
