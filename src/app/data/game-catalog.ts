import { GameRecordKey } from '../models/personal-record';

export type GameId =
  | 'classic-country-to-flag-easy'
  | 'classic-country-to-flag-hard'
  | 'classic-flag-to-country-easy'
  | 'classic-flag-to-country-hard'
  | 'classic-shape-to-country-easy'
  | 'classic-shape-to-country-hard'
  | 'flag-chrono'
  | 'flag-culture'
  | 'find-the-error'
  | 'pixel-flag'
  | 'flag-rebuild';

export type GameCatalogItem = {
  id: GameId;
  labelKey: string;
  descriptionKey: string;
  route: string[];
  recordKeys: GameRecordKey[];
  available: boolean;
};

export const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: 'classic-country-to-flag-easy',
    labelKey: 'home.game.classic-ctf-easy.label',
    descriptionKey: 'home.game.classic-ctf-easy.description',
    route: ['/jeu/pays-vers-drapeaux', 'easy'],
    recordKeys: ['country-to-flag-easy'],
    available: true
  },
  {
    id: 'classic-country-to-flag-hard',
    labelKey: 'home.game.classic-ctf-hard.label',
    descriptionKey: 'home.game.classic-ctf-hard.description',
    route: ['/jeu/pays-vers-drapeaux', 'hard'],
    recordKeys: ['country-to-flag-hard'],
    available: true
  },
  {
    id: 'classic-flag-to-country-easy',
    labelKey: 'home.game.classic-ftc-easy.label',
    descriptionKey: 'home.game.classic-ftc-easy.description',
    route: ['/jeu/drapeaux-vers-pays', 'easy'],
    recordKeys: ['flag-to-country-easy'],
    available: true
  },
  {
    id: 'classic-flag-to-country-hard',
    labelKey: 'home.game.classic-ftc-hard.label',
    descriptionKey: 'home.game.classic-ftc-hard.description',
    route: ['/jeu/drapeaux-vers-pays', 'hard'],
    recordKeys: ['flag-to-country-hard'],
    available: true
  },
  {
    id: 'classic-shape-to-country-easy',
    labelKey: 'home.game.classic-stc-easy.label',
    descriptionKey: 'home.game.classic-stc-easy.description',
    route: ['/jeu/formes-vers-pays', 'easy'],
    recordKeys: ['shape-to-country-easy'],
    available: true
  },
  {
    id: 'classic-shape-to-country-hard',
    labelKey: 'home.game.classic-stc-hard.label',
    descriptionKey: 'home.game.classic-stc-hard.description',
    route: ['/jeu/formes-vers-pays', 'hard'],
    recordKeys: ['shape-to-country-hard'],
    available: true
  },
  {
    id: 'flag-chrono',
    labelKey: 'home.game.flag-chrono.label',
    descriptionKey: 'home.game.flag-chrono.description',
    route: ['/jeu/chrono-drapeaux'],
    recordKeys: ['chrono-flags'],
    available: true
  },
  {
    id: 'flag-culture',
    labelKey: 'home.game.flag-culture.label',
    descriptionKey: 'home.game.flag-culture.description',
    route: ['/jeu/culture-drapeaux'],
    recordKeys: ['flag-culture-easy', 'flag-culture-medium', 'flag-culture-hard', 'flag-culture-mixed'],
    available: false
  },
  {
    id: 'find-the-error',
    labelKey: 'home.game.find-the-error.label',
    descriptionKey: 'home.game.find-the-error.description',
    route: ['/jeu/trouver-erreur'],
    recordKeys: ['find-the-error'],
    available: true
  },
  {
    id: 'pixel-flag',
    labelKey: 'home.game.pixel-flag.label',
    descriptionKey: 'home.game.pixel-flag.description',
    route: ['/jeu/drapeau-pixelise'],
    recordKeys: ['pixel-flag'],
    available: true
  },
  {
    id: 'flag-rebuild',
    labelKey: 'home.game.flag-rebuild.label',
    descriptionKey: 'home.game.flag-rebuild.description',
    route: ['/jeu/reconstruction-drapeau'],
    recordKeys: ['flag-rebuild'],
    available: true
  }
];

export const GAME_CATALOG_BY_ID: Record<GameId, GameCatalogItem> = GAME_CATALOG.reduce(
  (acc, item) => ({ ...acc, [item.id]: item }),
  {} as Record<GameId, GameCatalogItem>
);
