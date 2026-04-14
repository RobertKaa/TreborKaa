import { Routes } from '@angular/router';
import { CountriesPageComponent } from './pages/countries-page.component';
import { CountryToFlagGamePageComponent } from './pages/country-to-flag-game-page.component';
import { ChronoFlagsGamePageComponent } from './pages/chrono-flags-game-page.component';
import { FindTheErrorGamePageComponent } from './pages/find-the-error-game-page.component';
import { FlagCultureGamePageComponent } from './pages/flag-culture-game-page.component';
import { FlagRebuildGamePageComponent } from './pages/flag-rebuild-game-page.component';
import { FlagToCountryGamePageComponent } from './pages/flag-to-country-game-page.component';
import { HomePageComponent } from './pages/home-page.component';
import { PixelatedFlagGamePageComponent } from './pages/pixelated-flag-game-page.component';
import { RecordsPageComponent } from './pages/records-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent
  },
  {
    path: 'pays',
    component: CountriesPageComponent
  },
  {
    path: 'records',
    component: RecordsPageComponent
  },
  {
    path: 'jeu/pays-vers-drapeaux/:difficulty',
    component: CountryToFlagGamePageComponent
  },
  {
    path: 'jeu/drapeaux-vers-pays/:difficulty',
    component: FlagToCountryGamePageComponent
  },
  {
    path: 'jeu/reconstruction-drapeau',
    component: FlagRebuildGamePageComponent
  },
  {
    path: 'jeu/trouver-erreur',
    component: FindTheErrorGamePageComponent
  },
  {
    path: 'jeu/drapeau-pixelise',
    component: PixelatedFlagGamePageComponent
  },
  {
    path: 'jeu/chrono-drapeaux',
    component: ChronoFlagsGamePageComponent
  },
  {
    path: 'jeu/culture-drapeaux',
    component: FlagCultureGamePageComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
