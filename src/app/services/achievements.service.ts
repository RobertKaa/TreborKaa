import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { GAME_CATALOG, GameId } from '../data/game-catalog';
import { GameRecordKey } from '../models/personal-record';
import { BrowserStorageService } from './browser-storage.service';
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
  | 'hard-mode-scout'
  | 'hard-mode-ace'
  | 'visual-trio'
  | 'chrono-sprinter'
  | 'rebuild-architect'
  | 'all-available-games'
  | 'collector-level-5'
  | 'collector-level-10'
  | 'mystery-visual-curator'
  | 'mystery-combo'
  | 'mystery-clean-tour'
  | 'mystery-full-house';

type AchievementDefinition = {
  id: AchievementId;
  titleKey: string;
  descriptionKey: string;
  hidden?: boolean;
  color: 'lime' | 'amber' | 'cyan' | 'rose' | 'violet';
  points: number;
};

type AchievementStore = Partial<Record<AchievementId, string>>;

export type AchievementState = AchievementDefinition & {
  unlockedAt: string | null;
  unlocked: boolean;
  displayTitleKey: string;
  displayDescriptionKey: string;
};

export type GamificationProfile = {
  xp: number;
  level: number;
  levelLabelKey: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  achievementPoints: number;
  nextAchievement: AchievementState | null;
};

const STORAGE_KEY = 'vexiio.achievements.v1';
const ENABLED_RECORD_KEYS = new Set(
  GAME_CATALOG.filter((game) => game.available).flatMap((game) => game.recordKeys),
);
const HARD_RECORD_KEYS: GameRecordKey[] = [
  'country-to-flag-hard',
  'flag-to-country-hard',
  'shape-to-country-hard',
];
const VISUAL_RECORD_KEYS: GameRecordKey[] = ['find-the-error', 'pixel-flag', 'flag-rebuild'];

const DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-game',
    titleKey: 'achievement.first-game.title',
    descriptionKey: 'achievement.first-game.description',
    color: 'lime',
    points: 25,
  },
  {
    id: 'five-runs',
    titleKey: 'achievement.five-runs.title',
    descriptionKey: 'achievement.five-runs.description',
    color: 'lime',
    points: 40,
  },
  {
    id: 'three-games',
    titleKey: 'achievement.three-games.title',
    descriptionKey: 'achievement.three-games.description',
    color: 'amber',
    points: 60,
  },
  {
    id: 'seven-games',
    titleKey: 'achievement.seven-games.title',
    descriptionKey: 'achievement.seven-games.description',
    color: 'amber',
    points: 100,
  },
  {
    id: 'accuracy-90',
    titleKey: 'achievement.accuracy-90.title',
    descriptionKey: 'achievement.accuracy-90.description',
    color: 'cyan',
    points: 80,
  },
  {
    id: 'perfect-score',
    titleKey: 'achievement.perfect-score.title',
    descriptionKey: 'achievement.perfect-score.description',
    color: 'violet',
    points: 120,
  },
  {
    id: 'twenty-runs',
    titleKey: 'achievement.twenty-runs.title',
    descriptionKey: 'achievement.twenty-runs.description',
    color: 'amber',
    points: 150,
  },
  {
    id: 'three-favorites',
    titleKey: 'achievement.three-favorites.title',
    descriptionKey: 'achievement.three-favorites.description',
    color: 'cyan',
    points: 45,
  },
  {
    id: 'streak-master',
    titleKey: 'achievement.streak-master.title',
    descriptionKey: 'achievement.streak-master.description',
    color: 'rose',
    points: 110,
  },
  {
    id: 'streak-legend',
    titleKey: 'achievement.streak-legend.title',
    descriptionKey: 'achievement.streak-legend.description',
    color: 'violet',
    points: 180,
  },
  {
    id: 'resume-ready',
    titleKey: 'achievement.resume-ready.title',
    descriptionKey: 'achievement.resume-ready.description',
    color: 'lime',
    points: 35,
  },
  {
    id: 'hard-mode-scout',
    titleKey: 'achievement.hard-mode-scout.title',
    descriptionKey: 'achievement.hard-mode-scout.description',
    color: 'rose',
    points: 70,
  },
  {
    id: 'hard-mode-ace',
    titleKey: 'achievement.hard-mode-ace.title',
    descriptionKey: 'achievement.hard-mode-ace.description',
    color: 'rose',
    points: 140,
  },
  {
    id: 'visual-trio',
    titleKey: 'achievement.visual-trio.title',
    descriptionKey: 'achievement.visual-trio.description',
    color: 'cyan',
    points: 120,
  },
  {
    id: 'chrono-sprinter',
    titleKey: 'achievement.chrono-sprinter.title',
    descriptionKey: 'achievement.chrono-sprinter.description',
    color: 'amber',
    points: 110,
  },
  {
    id: 'rebuild-architect',
    titleKey: 'achievement.rebuild-architect.title',
    descriptionKey: 'achievement.rebuild-architect.description',
    color: 'lime',
    points: 90,
  },
  {
    id: 'all-available-games',
    titleKey: 'achievement.all-available-games.title',
    descriptionKey: 'achievement.all-available-games.description',
    color: 'violet',
    points: 220,
  },
  {
    id: 'collector-level-5',
    titleKey: 'achievement.collector-level-5.title',
    descriptionKey: 'achievement.collector-level-5.description',
    color: 'lime',
    points: 60,
  },
  {
    id: 'collector-level-10',
    titleKey: 'achievement.collector-level-10.title',
    descriptionKey: 'achievement.collector-level-10.description',
    color: 'violet',
    points: 150,
  },
  {
    id: 'mystery-visual-curator',
    titleKey: 'achievement.mystery-visual-curator.title',
    descriptionKey: 'achievement.mystery-visual-curator.description',
    hidden: true,
    color: 'violet',
    points: 120,
  },
  {
    id: 'mystery-combo',
    titleKey: 'achievement.mystery-combo.title',
    descriptionKey: 'achievement.mystery-combo.description',
    hidden: true,
    color: 'violet',
    points: 160,
  },
  {
    id: 'mystery-clean-tour',
    titleKey: 'achievement.mystery-clean-tour.title',
    descriptionKey: 'achievement.mystery-clean-tour.description',
    hidden: true,
    color: 'violet',
    points: 180,
  },
  {
    id: 'mystery-full-house',
    titleKey: 'achievement.mystery-full-house.title',
    descriptionKey: 'achievement.mystery-full-house.description',
    hidden: true,
    color: 'violet',
    points: 240,
  },
];

@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private readonly storage = inject(BrowserStorageService);
  private readonly recordsService = inject(PersonalRecordsService);
  private readonly favoritesService = inject(FavoriteGamesService);
  private readonly progressService = inject(GameProgressService);
  private readonly unlocked = signal<AchievementStore>(this.loadFromStorage());
  private readonly latestUnlockSignal = signal<AchievementState | null>(null);

  readonly unlockedCount = computed(() => Object.keys(this.unlocked()).length);
  readonly achievements = computed<AchievementState[]>(() =>
    DEFINITIONS.map((definition) => {
      const unlockedAt = this.unlocked()[definition.id] ?? null;
      return {
        ...definition,
        unlockedAt,
        unlocked: !!unlockedAt,
        displayTitleKey:
          definition.hidden && !unlockedAt
            ? 'achievement.mystery.locked.title'
            : definition.titleKey,
        displayDescriptionKey:
          definition.hidden && !unlockedAt
            ? 'achievement.mystery.locked.description'
            : definition.descriptionKey,
      };
    }),
  );
  readonly visibleAchievements = computed(() =>
    this.achievements().filter((achievement) => !achievement.hidden || achievement.unlocked),
  );
  readonly latestUnlock = this.latestUnlockSignal.asReadonly();
  readonly snapshot = computed(() => this.unlocked());
  readonly profile = computed<GamificationProfile>(() => this.buildProfile());

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
      const hardRecordCount = HARD_RECORD_KEYS.filter((key) => !!records[key]).length;
      const visualRecordCount = VISUAL_RECORD_KEYS.filter((key) => !!records[key]).length;
      const hasAllAvailableGames = uniqueRecordCount >= ENABLED_RECORD_KEYS.size;

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

      if (hardRecordCount >= 1) {
        this.unlock('hard-mode-scout');
      }

      if (hardRecordCount >= HARD_RECORD_KEYS.length) {
        this.unlock('hard-mode-ace');
      }

      if (visualRecordCount >= VISUAL_RECORD_KEYS.length) {
        this.unlock('visual-trio');
      }

      if (
        (records['chrono-flags']?.bestStreak ?? 0) >= 8 ||
        (records['chrono-flags']?.bestScore ?? 0) >= 900
      ) {
        this.unlock('chrono-sprinter');
      }

      if (
        (records['flag-rebuild']?.gamesPlayed ?? 0) > 0 &&
        (records['flag-rebuild']?.bestPercent ?? 0) >= 80
      ) {
        this.unlock('rebuild-architect');
      }

      if (hasAllAvailableGames) {
        this.unlock('all-available-games');
      }

      if (this.profile().level >= 5) {
        this.unlock('collector-level-5');
      }

      if (this.profile().level >= 10) {
        this.unlock('collector-level-10');
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

      const hasCleanClassicTour =
        HARD_RECORD_KEYS.every((key) => (records[key]?.bestPercent ?? 0) >= 100) &&
        (records['chrono-flags']?.bestPercent ?? 0) >= 90;
      if (hasCleanClassicTour) {
        this.unlock('mystery-clean-tour');
      }

      if (hasAllAvailableGames && favoriteCount >= 5 && maxStreak >= 10) {
        this.unlock('mystery-full-house');
      }
    });
  }

  acknowledgeLatestUnlock(): void {
    this.latestUnlockSignal.set(null);
  }

  mergeUnlocks(unlocks: Partial<Record<string, string>>): void {
    const next: AchievementStore = { ...this.unlocked() };

    for (const [id, unlockedAt] of Object.entries(unlocks)) {
      if (!this.isAchievementId(id) || typeof unlockedAt !== 'string') {
        continue;
      }

      const existing = next[id];
      next[id] = existing && Date.parse(existing) <= Date.parse(unlockedAt) ? existing : unlockedAt;
    }

    this.unlocked.set(next);
    this.persist();
  }

  private unlock(id: AchievementId): void {
    if (this.unlocked()[id]) {
      return;
    }

    const unlockedAt = new Date().toISOString();
    this.unlocked.update((current) => ({
      ...current,
      [id]: unlockedAt,
    }));
    this.persist();
    this.latestUnlockSignal.set(this.buildUnlockedState(id, unlockedAt));
  }

  private loadFromStorage(): AchievementStore {
    const parsed = this.storage.getJson<AchievementStore>(STORAGE_KEY, {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.unlocked());
  }

  private hasAllFavorites(current: GameId[], expected: GameId[]): boolean {
    const favoriteSet = new Set(current);
    return expected.every((id) => favoriteSet.has(id));
  }

  private isAchievementId(id: string): id is AchievementId {
    return DEFINITIONS.some((definition) => definition.id === id);
  }

  private buildUnlockedState(id: AchievementId, unlockedAt: string): AchievementState | null {
    const definition = DEFINITIONS.find((item) => item.id === id);
    if (!definition) {
      return null;
    }

    return {
      ...definition,
      unlockedAt,
      unlocked: true,
      displayTitleKey: definition.titleKey,
      displayDescriptionKey: definition.descriptionKey,
    };
  }

  private buildProfile(): GamificationProfile {
    const records = Object.entries(this.recordsService.snapshot())
      .filter(([key, entry]) => ENABLED_RECORD_KEYS.has(key as GameRecordKey) && !!entry)
      .map(([, entry]) => entry!);
    const achievementPoints = this.achievements()
      .filter((achievement) => achievement.unlocked)
      .reduce((sum, achievement) => sum + achievement.points, 0);
    const recordXp = records.reduce(
      (sum, record) =>
        sum +
        record.gamesPlayed * 35 +
        record.bestPercent * 2 +
        (record.bestStreak ?? 0) * 20 +
        Math.min(record.bestScore, 500),
      0,
    );
    const xp = Math.round(recordXp + achievementPoints);
    const level = Math.max(1, Math.floor(Math.sqrt(xp / 140)) + 1);
    const currentLevelXp = this.levelThreshold(level);
    const nextLevelXp = this.levelThreshold(level + 1);
    const nextAchievement =
      this.achievements().find((achievement) => !achievement.unlocked && !achievement.hidden) ??
      this.achievements().find((achievement) => !achievement.unlocked) ??
      null;

    return {
      xp,
      level,
      levelLabelKey: this.getLevelLabelKey(level),
      currentLevelXp,
      nextLevelXp,
      progressPercent:
        nextLevelXp > currentLevelXp
          ? Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100)
          : 100,
      achievementPoints,
      nextAchievement,
    };
  }

  private levelThreshold(level: number): number {
    return Math.pow(Math.max(0, level - 1), 2) * 140;
  }

  private getLevelLabelKey(level: number): string {
    if (level >= 10) {
      return 'gamification.rank.legend';
    }

    if (level >= 7) {
      return 'gamification.rank.expert';
    }

    if (level >= 4) {
      return 'gamification.rank.explorer';
    }

    return 'gamification.rank.rookie';
  }
}
