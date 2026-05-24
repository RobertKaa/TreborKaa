import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { GAME_CATALOG } from '../data/game-catalog';
import { GameRecordKey } from '../models/personal-record';
import { SPEEDRUN_SPLITS } from '../models/speedrun';
import { BrowserStorageService } from './browser-storage.service';
import { DailyChallengeService } from './daily-challenge.service';
import { GameProgressService } from './game-progress.service';
import { PersonalRecordsService } from './personal-records.service';
import { SpeedrunRecordsService } from './speedrun-records.service';
import { SupabaseAuthService } from './supabase-auth.service';
import {
  ACHIEVEMENT_XP_BY_DIFFICULTY,
  AchievementDifficulty,
  LevelTierId,
  buildLevelProgress,
  calculateRecordXp,
  calculateSpeedrunXp,
} from './xp-progression';

export type AchievementId =
  | 'first-game'
  | 'five-runs'
  | 'twenty-runs'
  | 'three-games'
  | 'seven-games'
  | 'accuracy-90'
  | 'perfect-score'
  | 'streak-master'
  | 'streak-legend'
  | 'resume-ready'
  | 'visual-trio'
  | 'chrono-sprinter'
  | 'rebuild-architect'
  | 'all-available-games'
  | 'collector-level-5'
  | 'collector-level-10'
  | 'mystery-combo'
  | 'mystery-clean-tour'
  | 'mystery-full-house';

type AchievementDefinition = {
  id: AchievementId;
  titleKey: string;
  descriptionKey: string;
  hidden?: boolean;
  color: 'lime' | 'amber' | 'cyan' | 'rose' | 'violet';
  difficulty: AchievementDifficulty;
};

type AchievementStore = Partial<Record<AchievementId, string>>;

export type AchievementState = AchievementDefinition & {
  points: number;
  unlockedAt: string | null;
  unlocked: boolean;
  displayTitleKey: string;
  displayDescriptionKey: string;
};

export type GamificationProfile = {
  xp: number;
  level: number;
  levelTier: LevelTierId;
  levelTierLabelKey: string;
  nextTierLevel: number | null;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  achievementPoints: number;
  speedrunPoints: number;
  nextAchievement: AchievementState | null;
};

const STORAGE_KEY = 'vexiio.achievements.v1';
const ENABLED_RECORD_KEYS = new Set(
  GAME_CATALOG.filter((game) => game.available).flatMap((game) => game.recordKeys),
);
const CLASSIC_RECORD_KEYS: GameRecordKey[] = [
  'country-to-flag-easy',
  'flag-to-country-easy',
  'shape-to-country-easy',
];
const VISUAL_RECORD_KEYS: GameRecordKey[] = ['find-the-error', 'pixel-flag', 'flag-rebuild'];

const DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-game',
    titleKey: 'achievement.first-game.title',
    descriptionKey: 'achievement.first-game.description',
    color: 'lime',
    difficulty: 'easy',
  },
  {
    id: 'five-runs',
    titleKey: 'achievement.five-runs.title',
    descriptionKey: 'achievement.five-runs.description',
    color: 'lime',
    difficulty: 'easy',
  },
  {
    id: 'three-games',
    titleKey: 'achievement.three-games.title',
    descriptionKey: 'achievement.three-games.description',
    color: 'amber',
    difficulty: 'medium',
  },
  {
    id: 'seven-games',
    titleKey: 'achievement.seven-games.title',
    descriptionKey: 'achievement.seven-games.description',
    color: 'amber',
    difficulty: 'medium',
  },
  {
    id: 'accuracy-90',
    titleKey: 'achievement.accuracy-90.title',
    descriptionKey: 'achievement.accuracy-90.description',
    color: 'cyan',
    difficulty: 'medium',
  },
  {
    id: 'perfect-score',
    titleKey: 'achievement.perfect-score.title',
    descriptionKey: 'achievement.perfect-score.description',
    color: 'violet',
    difficulty: 'hard',
  },
  {
    id: 'twenty-runs',
    titleKey: 'achievement.twenty-runs.title',
    descriptionKey: 'achievement.twenty-runs.description',
    color: 'amber',
    difficulty: 'hard',
  },
  {
    id: 'streak-master',
    titleKey: 'achievement.streak-master.title',
    descriptionKey: 'achievement.streak-master.description',
    color: 'rose',
    difficulty: 'hard',
  },
  {
    id: 'streak-legend',
    titleKey: 'achievement.streak-legend.title',
    descriptionKey: 'achievement.streak-legend.description',
    color: 'violet',
    difficulty: 'hard',
  },
  {
    id: 'resume-ready',
    titleKey: 'achievement.resume-ready.title',
    descriptionKey: 'achievement.resume-ready.description',
    color: 'lime',
    difficulty: 'easy',
  },
  {
    id: 'visual-trio',
    titleKey: 'achievement.visual-trio.title',
    descriptionKey: 'achievement.visual-trio.description',
    color: 'cyan',
    difficulty: 'medium',
  },
  {
    id: 'chrono-sprinter',
    titleKey: 'achievement.chrono-sprinter.title',
    descriptionKey: 'achievement.chrono-sprinter.description',
    color: 'amber',
    difficulty: 'medium',
  },
  {
    id: 'rebuild-architect',
    titleKey: 'achievement.rebuild-architect.title',
    descriptionKey: 'achievement.rebuild-architect.description',
    color: 'lime',
    difficulty: 'medium',
  },
  {
    id: 'all-available-games',
    titleKey: 'achievement.all-available-games.title',
    descriptionKey: 'achievement.all-available-games.description',
    color: 'violet',
    difficulty: 'hard',
  },
  {
    id: 'collector-level-5',
    titleKey: 'achievement.collector-level-5.title',
    descriptionKey: 'achievement.collector-level-5.description',
    color: 'lime',
    difficulty: 'medium',
  },
  {
    id: 'collector-level-10',
    titleKey: 'achievement.collector-level-10.title',
    descriptionKey: 'achievement.collector-level-10.description',
    color: 'violet',
    difficulty: 'hard',
  },
  {
    id: 'mystery-combo',
    titleKey: 'achievement.mystery-combo.title',
    descriptionKey: 'achievement.mystery-combo.description',
    hidden: true,
    color: 'violet',
    difficulty: 'rare',
  },
  {
    id: 'mystery-clean-tour',
    titleKey: 'achievement.mystery-clean-tour.title',
    descriptionKey: 'achievement.mystery-clean-tour.description',
    hidden: true,
    color: 'violet',
    difficulty: 'rare',
  },
  {
    id: 'mystery-full-house',
    titleKey: 'achievement.mystery-full-house.title',
    descriptionKey: 'achievement.mystery-full-house.description',
    hidden: true,
    color: 'violet',
    difficulty: 'rare',
  },
];

@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private readonly storage = inject(BrowserStorageService);
  private readonly recordsService = inject(PersonalRecordsService);
  private readonly progressService = inject(GameProgressService);
  private readonly dailyChallengeService = inject(DailyChallengeService);
  private readonly speedrunRecordsService = inject(SpeedrunRecordsService);
  private readonly auth = inject(SupabaseAuthService);
  private readonly unlocked = signal<AchievementStore>(this.loadFromStorage());
  private readonly latestUnlockSignal = signal<AchievementState | null>(null);

  readonly unlockedCount = computed(() => Object.keys(this.unlocked()).length);
  readonly achievements = computed<AchievementState[]>(() =>
    DEFINITIONS.map((definition) => {
      const unlockedAt = this.unlocked()[definition.id] ?? null;
      return {
        ...definition,
        points: ACHIEVEMENT_XP_BY_DIFFICULTY[definition.difficulty],
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
      const inProgressCount = this.progressService.count();
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

      if (maxStreak >= 10) {
        this.unlock('streak-master');
      }

      if (maxStreak >= 20) {
        this.unlock('streak-legend');
      }

      if (inProgressCount >= 1) {
        this.unlock('resume-ready');
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

      const hasClassicCombo =
        (records['country-to-flag-easy']?.gamesPlayed ?? 0) > 0 &&
        (records['flag-to-country-easy']?.gamesPlayed ?? 0) > 0 &&
        (records['chrono-flags']?.bestStreak ?? 0) >= 5;
      if (hasClassicCombo) {
        this.unlock('mystery-combo');
      }

      const hasCleanClassicTour =
        CLASSIC_RECORD_KEYS.every((key) => (records[key]?.bestPercent ?? 0) >= 100) &&
        (records['chrono-flags']?.bestPercent ?? 0) >= 90;
      if (hasCleanClassicTour) {
        this.unlock('mystery-clean-tour');
      }

      if (hasAllAvailableGames && totalGamesPlayed >= 20 && maxStreak >= 10) {
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
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const next: AchievementStore = {};
    for (const [id, unlockedAt] of Object.entries(parsed)) {
      if (this.isAchievementId(id) && typeof unlockedAt === 'string') {
        next[id] = unlockedAt;
      }
    }

    return next;
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.unlocked());
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
      points: ACHIEVEMENT_XP_BY_DIFFICULTY[definition.difficulty],
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
    const recordXp = records.reduce((sum, record) => sum + calculateRecordXp(record), 0);
    const speedrunPoints = this.buildSpeedrunXp();
    const xp = Math.round(
      recordXp + achievementPoints + speedrunPoints + this.dailyChallengeService.bonusXp(),
    );
    const levelProgress = buildLevelProgress(xp);
    const nextAchievement =
      this.achievements().find((achievement) => !achievement.unlocked && !achievement.hidden) ??
      this.achievements().find((achievement) => !achievement.unlocked) ??
      null;

    return {
      xp,
      level: levelProgress.level,
      levelTier: levelProgress.tier.id,
      levelTierLabelKey: levelProgress.tier.labelKey,
      nextTierLevel: levelProgress.tier.nextLevel,
      currentLevelXp: levelProgress.currentLevelXp,
      nextLevelXp: levelProgress.nextLevelXp,
      progressPercent: levelProgress.progressPercent,
      achievementPoints,
      speedrunPoints,
      nextAchievement,
    };
  }

  private buildSpeedrunXp(): number {
    const userId = this.auth.user()?.id;
    this.speedrunRecordsService.snapshot();

    if (!userId) {
      return 0;
    }

    return calculateSpeedrunXp(
      this.speedrunRecordsService.getBestForUser(userId),
      SPEEDRUN_SPLITS.map((split) =>
        this.speedrunRecordsService.getBestSplitForUser(userId, split.id),
      ),
    );
  }
}
