import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { XpProgressHeaderComponent } from './xp-progress-header.component';
import { AchievementsService } from '../services/achievements.service';
import { I18nService } from '../services/i18n.service';

const profileFixture = {
  xp: 1250,
  xpSource: 'server' as const,
  level: 4,
  levelTier: 'gray' as const,
  levelTierLabelKey: 'gamification.tier.gray',
  nextTierLevel: 5,
  currentLevelXp: 900,
  nextLevelXp: 1500,
  progressPercent: 70,
  achievementPoints: 50,
  speedrunPoints: 0,
  nextAchievement: null,
};

describe('XpProgressHeaderComponent', () => {
  let fixture: ComponentFixture<XpProgressHeaderComponent>;
  let xpProfileReady: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    xpProfileReady = signal(true);

    await TestBed.configureTestingModule({
      imports: [XpProgressHeaderComponent],
      providers: [
        {
          provide: AchievementsService,
          useValue: {
            profile: signal(profileFixture),
            xpProfileReady,
          },
        },
        {
          provide: I18nService,
          useValue: {
            locale: () => 'fr-FR',
            t: (key: string, params?: Record<string, string | number>) => {
              if (key === 'gamification.xpToNextLevel' && params) {
                return `${params['remaining']} XP avant le niveau ${params['level']}`;
              }

              if (key === 'gamification.level' && params) {
                return `Niveau ${params['level']}`;
              }

              if (key === 'gamification.headerProgressAria') {
                return 'Progression XP et niveau';
              }

              if (key === 'gamification.headerProgressLoading') {
                return 'Chargement de la progression XP';
              }

              if (key === 'gamification.nextLevelProgress' && params) {
                return `${params['percent']}% vers le niveau suivant`;
              }

              return key;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(XpProgressHeaderComponent);
    fixture.detectChanges();
  });

  it('renders level badge, progress bar and next level goal when ready', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.xp-progress-crest strong')?.textContent?.trim()).toBe('4');
    expect(element.querySelector('.xp-progress-crest small')).toBeNull();
    expect(element.querySelector('.xp-progress-head')).toBeNull();
    expect(element.querySelector('.xp-progress-goal')?.textContent).toContain(
      '250 XP avant le niveau 5',
    );
    expect(element.querySelector('.xp-progress-meter span')?.getAttribute('style')).toContain(
      '70%',
    );
  });

  it('shows a skeleton while authoritative xp is loading', () => {
    xpProfileReady.set(false);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.xp-progress-header--loading')).not.toBeNull();
    expect(element.querySelector('.xp-progress-crest')).toBeNull();
    expect(element.querySelector('.xp-progress-skeleton--badge')).not.toBeNull();
    expect(element.querySelector('.xp-progress-meter')).toBeNull();
  });
});
