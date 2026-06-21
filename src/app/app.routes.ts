import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    path: 'pays',
    loadComponent: () =>
      import('./pages/countries-page.component').then((m) => m.CountriesPageComponent),
  },
  {
    path: 'records',
    loadComponent: () =>
      import('./pages/records-page.component').then((m) => m.RecordsPageComponent),
  },
  {
    path: 'succes',
    loadComponent: () =>
      import('./pages/achievements-page.component').then((m) => m.AchievementsPageComponent),
  },
  {
    path: 'speedrun',
    loadComponent: () =>
      import('./pages/speedrun-page.component').then((m) => m.SpeedrunPageComponent),
  },
  {
    path: 'speedrun/classement',
    redirectTo: '/speedrun',
    pathMatch: 'full',
  },
  {
    path: 'defi-du-jour',
    loadComponent: () =>
      import('./pages/daily-challenge-page.component').then(
        (m) => m.DailyChallengePageComponent,
      ),
  },
  {
    path: 'confidentialite',
    loadComponent: () =>
      import('./pages/privacy-page.component').then((m) => m.PrivacyPageComponent),
  },
  {
    path: 'jeu/pays-vers-drapeaux',
    loadComponent: () =>
      import('./pages/country-to-flag-game-page.component').then(
        (m) => m.CountryToFlagGamePageComponent,
      ),
  },
  {
    path: 'jeu/pays-vers-drapeaux/:difficulty',
    redirectTo: '/jeu/pays-vers-drapeaux',
  },
  {
    path: 'jeu/drapeaux-vers-pays',
    loadComponent: () =>
      import('./pages/flag-to-country-game-page.component').then(
        (m) => m.FlagToCountryGamePageComponent,
      ),
  },
  {
    path: 'jeu/drapeaux-vers-pays/:difficulty',
    redirectTo: '/jeu/drapeaux-vers-pays',
  },
  {
    path: 'jeu/formes-vers-pays',
    loadComponent: () =>
      import('./pages/shape-to-country-game-page.component').then(
        (m) => m.ShapeToCountryGamePageComponent,
      ),
  },
  {
    path: 'jeu/formes-vers-pays/:difficulty',
    redirectTo: '/jeu/formes-vers-pays',
  },
  {
    path: 'jeu/capitale-vers-pays',
    loadComponent: () =>
      import('./pages/capital-to-country-game-page.component').then(
        (m) => m.CapitalToCountryGamePageComponent,
      ),
  },
  {
    path: 'jeu/capitale-vers-pays/:difficulty',
    redirectTo: '/jeu/capitale-vers-pays',
  },
  {
    path: 'jeu/reconstruction-drapeau',
    loadComponent: () =>
      import('./pages/flag-rebuild-game-page.component').then(
        (m) => m.FlagRebuildGamePageComponent,
      ),
  },
  {
    path: 'jeu/trouver-erreur',
    loadComponent: () =>
      import('./pages/find-the-error-game-page.component').then(
        (m) => m.FindTheErrorGamePageComponent,
      ),
  },
  {
    path: 'jeu/drapeau-pixelise',
    loadComponent: () =>
      import('./pages/pixelated-flag-game-page.component').then(
        (m) => m.PixelatedFlagGamePageComponent,
      ),
  },
  {
    path: 'jeu/chrono-drapeaux',
    loadComponent: () =>
      import('./pages/chrono-flags-game-page.component').then(
        (m) => m.ChronoFlagsGamePageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
