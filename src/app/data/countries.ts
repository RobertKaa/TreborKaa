import { CountryFlag } from '../models/country-flag';

export const COUNTRIES: CountryFlag[] = [
  {
    code: 'fr',
    name: 'France',
    capital: 'Paris',
    flagAssetName: 'fr.svg',
    similarFlags: ['Italie', 'Pays-Bas', 'Russie']
  },
  {
    code: 'it',
    name: 'Italie',
    capital: 'Rome',
    flagAssetName: 'it.svg',
    similarFlags: ['France', 'Irlande', 'Mexique']
  },
  {
    code: 'ie',
    name: 'Irlande',
    capital: 'Dublin',
    flagAssetName: 'ie.svg',
    similarFlags: ['Italie', 'Cote d Ivoire']
  },
  {
    code: 'ro',
    name: 'Roumanie',
    capital: 'Bucarest',
    flagAssetName: 'ro.svg',
    similarFlags: ['Tchad', 'Andorre']
  },
  {
    code: 'td',
    name: 'Tchad',
    capital: 'N Djamena',
    flagAssetName: 'td.svg',
    similarFlags: ['Roumanie']
  },
  {
    code: 'lu',
    name: 'Luxembourg',
    capital: 'Luxembourg',
    flagAssetName: 'lu.svg',
    similarFlags: ['Pays-Bas']
  }
];
