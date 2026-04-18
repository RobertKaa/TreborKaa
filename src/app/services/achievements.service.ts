import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { GAME_CATALOG, GameId } from '../data/game-catalog';
import { FavoriteGamesService } from './favorite-games.service';
import { GameProgressService } from './game-progress.service';
import { PersonalRecordsService } from './personal-records.service';

export type AchievementId =
  | 'first-game'
  | 'five-runs'
  | 'twenty-runs'
  | 'three-games'
  | 'seven-games'
  | 'accuracy-90'
  | 'perfect-score'
  | 'three-favorites'
  | 'streak-master'
  | 'streak-legend'
  | 'resume-ready'
  | 'mystery-visual-curator'
  | 'mystery-combo';

type AchievementDefinition = {
  id: AchievementId;
  titleKey: string;
  descriptionKey: string;
  hidden?: boolean;
  color: 'lime' | 'amber' | 'cyan' | 'rose' | 'violet';
};

type AchievementStore = Partial<Record<AchievementId, string>>;

export type AchievementState = AchievementDefinition & {
  unlockedAt: string | null;
  unlocked: boolean;
  displayTitleKey: string;
  displayDescriptionKey: string;
};

const STORAGE_KEY = 'vexiio.achievements.v1';
const ENABLED_RECORD_KEYS = new Set(
  GAME_CATALOG.filter((game) => game.available).flatMap((game) => game.recordKeys)
);

const DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-game',
    titleKey: 'achievement.first-game.title',
    descriptionKey: 'achievement.first-game.description',
    color: 'lime'
  },
  {
    id: 'five-runs',
    titleKey: 'achievement.five-runs.title',
    descriptionKey: 'achievement.five-runs.description',
    color: 'lime'
  },
  {
    id: 'three-games',
    titleKey: 'achievement.three-games.title',
    descriptionKey: 'achievement.three-games.description',
    color: 'amber'
  },
  {
    id: 'seven-games',
    titleKey: 'achievement.seven-games.title',
    descriptionKey: 'achievement.seven-games.description',
    color: 'amber'
  },
  {
    id: 'accuracy-90',
    titleKey: 'achievement.accuracy-90.title',
    descriptionKey: 'achievement.accuracy-90.description',
    color: 'cyan'
  },
  {
    id: 'perfect-score',
    titleKey: 'achievement.perfect-score.title',
    descriptionKey: 'achievement.perfect-score.description',
    color: 'violet'
  },
  {
    id: 'twenty-runs',
    titleKey: 'achievement.twenty-runs.title',
    descriptionKey: 'achievement.twenty-runs.description',
    color: 'amber'
  },
  {
    id: 'three-favorites',
    titleKey: 'achievement.three-favorites.title',
    descriptionKey: 'achievement.three-favorites.description',
    color: 'cyan'
  },
  {
    id: 'streak-master',
    titleKey: 'achievement.streak-master.title',
    descriptionKey: 'achievement.streak-master.description',
    color: 'rose'
  },
  {
    id: 'streak-legend',
    titleKey: 'achievement.streak-legend.title',
    descriptionKey: 'achievement.streak-legend.description',
    color: 'violet'
  },
  {
    id: 'resume-ready',
    titleKey: 'achievement.resume-ready.title',
    descriptionKey: 'achievement.resume-ready.description',
    color: 'lime'
  },
  {
    id: 'mystery-visual-curator',
    titleKey: 'achievement.mystery-visual-curator.title',
    descriptionKey: 'achievement.mystery-visual-curator.description',
    hidden: true,
    color: 'violet'
  },
  {
    id: 'mystery-combo',
    titleKey: 'achievement.mystery-combo.title',
    descriptionKey: 'achievement.mystery-combo.description',
    hidden: true,
    color: 'violet'
  }
];

@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private readonly recordsService = inject(PersonalRecordsService);
  private readonly favoritesService = inject(FavoriteGamesService);
  private readonly progressService = inject(GameProgressService);
  private readonly unlocked = signal<AchievementStore>(this.loadFromStorage());

  readonly unlockedCount = computed(() => Object.keys(this.unlocked()).length);
  readonly achievements = computed<AchievementState[]>(() =>
    DEFINITIONS.map((definition) => {
      const unlockedAt = this.unlocked()[definition.id] ?? null;
      return {
        ...definition,
        unlockedAt,
        unlocked: !!unlockedAt,
        displayTitleKey:
          definition.hidden && !unlockedAt ? 'achievement.mystery.locked.title' : definition.titleKey,
        displayDescriptionKey:
          definition.hidden && !unlockedAt
            ? 'achievement.mystery.locked.description'
            : definition.descriptionKey
      };
    })
  );

  constructor() {
    effect(() => {
      const records = this.recordsService.snapshot();
      const entries = Object.entries(records)
        .filter(([key, entry]) => ENABLED_RECORD_KEYS.has(key as keyof typeof records) && !!entry)
        .map(([, entry]) => entry!);
      const totalGamesPlayed = entries.reduce((sum, entry) => sum + (entry?.gamesPlayed ?? 0), 0);
      const uniqueRecordCount = entries.length;
      const maxStreak = entries.reduce((max, entry) => Math.max(max, entry?.bestStreak ?? 0), 0);
      const maxPercent = entries.reduce((max, entry) => Math.max(max, entry?.bestPercent ?? 0), 0);
      const favoriteCount = this.favoritesService.count();
      const favoriteIds = this.favoritesService.ids();
      const inProgressCount = this.progressService.count();

      if (totalGamesPlayed >= 1) {
        this.unlock('first-game');
      }

      if (totalGamesPlayed >= 5) {
        this.unlock('five-runs');
      }

      if (uniqueRecordCount >= 3) {
        this.unlock('three-games');
      }

      if (uniqueRecordCount >= 7) {
        this.unlock('seven-games');
      }

      if (totalGamesPlayed >= 20) {
        this.unlock('twenty-runs');
      }

      if (maxPercent >= 90) {
        this.unlock('accuracy-90');
      }

      if (maxPercent >= 100) {
        this.unlock('perfect-score');
      }

      if (favoriteCount >= 3) {
        this.unlock('three-favorites');
      }

      if (maxStreak >= 10) {
        this.unlock('streak-master');
      }

      if (maxStreak >= 20) {
        this.unlock('streak-legend');
      }

      if (inProgressCount >= 1) {
        this.unlock('resume-ready');
      }

      if (this.hasAllFavorites(favoriteIds, ['find-the-error', 'pixel-flag', 'flag-rebuild'])) {
        this.unlock('mystery-visual-curator');
      }

      const hasHardClassicCombo =
        (records['country-to-flag-hard']?.gamesPlayed ?? 0) > 0 &&
        (records['flag-to-country-hard']?.gamesPlayed ?? 0) > 0 &&
        (records['chrono-flags']?.bestStreak ?? 0) >= 5;
      if (hasHardClassicCombo) {
        this.unlock('mystery-combo');
      }
    });
  }

  private unlock(id: AchievementId): void {
    if (this.unlocked()[id]) {
      return;
    }

    this.unlocked.update((current) => ({
      ...current,
      [id]: new Date().toISOString()
    }));
    this.persist();
  }

  private loadFromStorage(): AchievementStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as AchievementStore;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.unlocked()));
    } catch {
      // Ignore storage errors.
    }
  }

  private hasAllFavorites(current: GameId[], expected: GameId[]): boolean {
    const favoriteSet = new Set(current);
    return expected.every((id) => favoriteSet.has(id));
  }
}
