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
  | 'fifty-runs'
  | 'three-games'
  | 'seven-games'
  | 'accuracy-90'
  | 'perfect-score'
  | 'three-perfect-records'
  | 'all-excellent'
  | 'streak-master'
  | 'streak-legend'
  | 'resume-ready'
  | 'visual-trio'
  | 'chrono-sprinter'
  | 'chrono-expert'
  | 'rebuild-architect'
  | 'rebuild-master'
  | 'all-available-games'
  | 'collector-level-5'
  | 'collector-level-10'
  | 'collector-level-20'
  | 'mystery-combo'
  | 'mystery-clean-tour'
  | 'mystery-full-house'
  | 'mystery-seven-perfect'
  | 'mystery-centurion';

type AchievementDefinition = {
  id: AchievementId;
  titleKey: string;
  descriptionKey: string;
  hidden?: boolean;
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

export type GamificationXpSource = 'local' | 'server';

export type GamificationProfile = {
  xp: number;
  xpSource: GamificationXpSource;
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
  'capital-to-country-easy',
];
const VISUAL_RECORD_KEYS: GameRecordKey[] = ['find-the-error', 'pixel-flag', 'flag-rebuild'];
const DIFFICULTY_ORDER: Record<AchievementDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  rare: 3,
};

const DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-game',
    titleKey: 'achievement.first-game.title',
    descriptionKey: 'achievement.first-game.description',
    difficulty: 'easy',
  },
  {
    id: 'five-runs',
    titleKey: 'achievement.five-runs.title',
    descriptionKey: 'achievement.five-runs.description',
    difficulty: 'easy',
  },
  {
    id: 'three-games',
    titleKey: 'achievement.three-games.title',
    descriptionKey: 'achievement.three-games.description',
    difficulty: 'medium',
  },
  {
    id: 'seven-games',
    titleKey: 'achievement.seven-games.title',
    descriptionKey: 'achievement.seven-games.description',
    difficulty: 'medium',
  },
  {
    id: 'accuracy-90',
    titleKey: 'achievement.accuracy-90.title',
    descriptionKey: 'achievement.accuracy-90.description',
    difficulty: 'medium',
  },
  {
    id: 'perfect-score',
    titleKey: 'achievement.perfect-score.title',
    descriptionKey: 'achievement.perfect-score.description',
    difficulty: 'hard',
  },
  {
    id: 'twenty-runs',
    titleKey: 'achievement.twenty-runs.title',
    descriptionKey: 'achievement.twenty-runs.description',
    difficulty: 'hard',
  },
  {
    id: 'fifty-runs',
    titleKey: 'achievement.fifty-runs.title',
    descriptionKey: 'achievement.fifty-runs.description',
    difficulty: 'hard',
  },
  {
    id: 'three-perfect-records',
    titleKey: 'achievement.three-perfect-records.title',
    descriptionKey: 'achievement.three-perfect-records.description',
    difficulty: 'hard',
  },
  {
    id: 'all-excellent',
    titleKey: 'achievement.all-excellent.title',
    descriptionKey: 'achievement.all-excellent.description',
    difficulty: 'hard',
  },
  {
    id: 'streak-master',
    titleKey: 'achievement.streak-master.title',
    descriptionKey: 'achievement.streak-master.description',
    difficulty: 'hard',
  },
  {
    id: 'streak-legend',
    titleKey: 'achievement.streak-legend.title',
    descriptionKey: 'achievement.streak-legend.description',
    difficulty: 'hard',
  },
  {
    id: 'resume-ready',
    titleKey: 'achievement.resume-ready.title',
    descriptionKey: 'achievement.resume-ready.description',
    difficulty: 'easy',
  },
  {
    id: 'visual-trio',
    titleKey: 'achievement.visual-trio.title',
    descriptionKey: 'achievement.visual-trio.description',
    difficulty: 'medium',
  },
  {
    id: 'chrono-sprinter',
    titleKey: 'achievement.chrono-sprinter.title',
    descriptionKey: 'achievement.chrono-sprinter.description',
    difficulty: 'medium',
  },
  {
    id: 'chrono-expert',
    titleKey: 'achievement.chrono-expert.title',
    descriptionKey: 'achievement.chrono-expert.description',
    difficulty: 'hard',
  },
  {
    id: 'rebuild-architect',
    titleKey: 'achievement.rebuild-architect.title',
    descriptionKey: 'achievement.rebuild-architect.description',
    difficulty: 'medium',
  },
  {
    id: 'rebuild-master',
    titleKey: 'achievement.rebuild-master.title',
    descriptionKey: 'achievement.rebuild-master.description',
    difficulty: 'hard',
  },
  {
    id: 'all-available-games',
    titleKey: 'achievement.all-available-games.title',
    descriptionKey: 'achievement.all-available-games.description',
    difficulty: 'hard',
  },
  {
    id: 'collector-level-5',
    titleKey: 'achievement.collector-level-5.title',
    descriptionKey: 'achievement.collector-level-5.description',
    difficulty: 'medium',
  },
  {
    id: 'collector-level-10',
    titleKey: 'achievement.collector-level-10.title',
    descriptionKey: 'achievement.collector-level-10.description',
    difficulty: 'hard',
  },
  {
    id: 'collector-level-20',
    titleKey: 'achievement.collector-level-20.title',
    descriptionKey: 'achievement.collector-level-20.description',
    difficulty: 'hard',
  },
  {
    id: 'mystery-combo',
    titleKey: 'achievement.mystery-combo.title',
    descriptionKey: 'achievement.mystery-combo.description',
    hidden: true,
    difficulty: 'rare',
  },
  {
    id: 'mystery-clean-tour',
    titleKey: 'achievement.mystery-clean-tour.title',
    descriptionKey: 'achievement.mystery-clean-tour.description',
    hidden: true,
    difficulty: 'rare',
  },
  {
    id: 'mystery-full-house',
    titleKey: 'achievement.mystery-full-house.title',
    descriptionKey: 'achievement.mystery-full-house.description',
    hidden: true,
    difficulty: 'rare',
  },
  {
    id: 'mystery-seven-perfect',
    titleKey: 'achievement.mystery-seven-perfect.title',
    descriptionKey: 'achievement.mystery-seven-perfect.description',
    hidden: true,
    difficulty: 'rare',
  },
  {
    id: 'mystery-centurion',
    titleKey: 'achievement.mystery-centurion.title',
    descriptionKey: 'achievement.mystery-centurion.description',
    hidden: true,
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
  private readonly authoritativeXpTotal = signal<number | null>(null);
  private readonly authoritativeXpLoaded = signal(false);

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
    }).sort(
      (left, right) => DIFFICULTY_ORDER[left.difficulty] - DIFFICULTY_ORDER[right.difficulty],
    ),
  );
  readonly visibleAchievements = computed(() =>
    this.achievements().filter((achievement) => !achievement.hidden || achievement.unlocked),
  );
  readonly latestUnlock = this.latestUnlockSignal.asReadonly();
  readonly snapshot = computed(() => this.unlocked());
  readonly profile = computed<GamificationProfile>(() => this.buildProfile());
  readonly xpProfileReady = computed(() => !this.auth.user() || this.authoritativeXpLoaded());

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
      const perfectRecordCount = entries.filter((entry) => entry.bestPercent >= 100).length;
      const inProgressCount = this.progressService.count();
      const visualRecordCount = VISUAL_RECORD_KEYS.filter((key) => !!records[key]).length;
      const hasAllAvailableGames = uniqueRecordCount >= ENABLED_RECORD_KEYS.size;
      const hasExcellentRecordEverywhere =
        hasAllAvailableGames && entries.every((entry) => entry.bestPercent >= 90);

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

      if (totalGamesPlayed >= 50) {
        this.unlock('fifty-runs');
      }

      if (maxPercent >= 90) {
        this.unlock('accuracy-90');
      }

      if (maxPercent >= 100) {
        this.unlock('perfect-score');
      }

      if (perfectRecordCount >= 3) {
        this.unlock('three-perfect-records');
      }

      if (hasExcellentRecordEverywhere) {
        this.unlock('all-excellent');
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
        (records['chrono-flags']?.bestStreak ?? 0) >= 15 ||
        (records['chrono-flags']?.bestScore ?? 0) >= 1500
      ) {
        this.unlock('chrono-expert');
      }

      if (
        (records['flag-rebuild']?.gamesPlayed ?? 0) > 0 &&
        (records['flag-rebuild']?.bestPercent ?? 0) >= 80
      ) {
        this.unlock('rebuild-architect');
      }

      if ((records['flag-rebuild']?.bestPercent ?? 0) >= 95) {
        this.unlock('rebuild-master');
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

      if (this.profile().level >= 20) {
        this.unlock('collector-level-20');
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

      if (hasAllAvailableGames && perfectRecordCount >= ENABLED_RECORD_KEYS.size) {
        this.unlock('mystery-seven-perfect');
      }

      if (hasAllAvailableGames && totalGamesPlayed >= 100) {
        this.unlock('mystery-centurion');
      }
    });
  }

  acknowledgeLatestUnlock(): void {
    this.latestUnlockSignal.set(null);
  }

  mergeUnlocks(unlocks: Partial<Record<string, string>>): void {
    const next: AchievementStore = { ...this.unlocked() };
    let changed = false;

    for (const [id, unlockedAt] of Object.entries(unlocks)) {
      if (!this.isAchievementId(id) || typeof unlockedAt !== 'string') {
        continue;
      }

      const existing = next[id];
      const merged =
        existing && Date.parse(existing) <= Date.parse(unlockedAt) ? existing : unlockedAt;
      if (existing !== merged) {
        next[id] = merged;
        changed = true;
      }
    }

    if (!changed) {
      return;
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

  setAuthoritativeXpTotal(total: number | null): void {
    if (total === null) {
      this.authoritativeXpTotal.set(null);
      this.authoritativeXpLoaded.set(false);
      return;
    }

    this.authoritativeXpTotal.set(Math.max(0, Math.round(total)));
    this.authoritativeXpLoaded.set(true);
  }

  clearAuthoritativeXpTotal(): void {
    this.authoritativeXpTotal.set(null);
    this.authoritativeXpLoaded.set(false);
  }

  resolveXpDisplayWithoutServer(): void {
    this.authoritativeXpLoaded.set(true);
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
    const localXp = Math.round(
      recordXp + achievementPoints + speedrunPoints + this.dailyChallengeService.bonusXp(),
    );
    const authoritativeXp = this.authoritativeXpTotal();
    const xp = authoritativeXp ?? localXp;
    const xpSource: GamificationXpSource = authoritativeXp === null ? 'local' : 'server';
    const levelProgress = buildLevelProgress(xp);
    const nextAchievement =
      this.achievements().find((achievement) => !achievement.unlocked && !achievement.hidden) ??
      this.achievements().find((achievement) => !achievement.unlocked) ??
      null;

    return {
      xp,
      xpSource,
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
