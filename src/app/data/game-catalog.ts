import { GameRecordKey } from '../models/personal-record';

export type GameId =
  | 'classic-country-to-flag-easy'
  | 'classic-flag-to-country-easy'
  | 'classic-shape-to-country-easy'
  | 'flag-chrono'
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
    labelKey: 'home.classicCountryToFlag',
    descriptionKey: 'home.classicCountryToFlag.description',
    route: ['/jeu/pays-vers-drapeaux'],
    recordKeys: ['country-to-flag-easy'],
    available: true
  },
  {
    id: 'classic-flag-to-country-easy',
    labelKey: 'home.classicFlagToCountry',
    descriptionKey: 'home.classicFlagToCountry.description',
    route: ['/jeu/drapeaux-vers-pays'],
    recordKeys: ['flag-to-country-easy'],
    available: true
  },
  {
    id: 'classic-shape-to-country-easy',
    labelKey: 'home.classicShapeToCountry',
    descriptionKey: 'home.classicShapeToCountry.description',
    route: ['/jeu/formes-vers-pays'],
    recordKeys: ['shape-to-country-easy'],
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
