import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type HomeGame = {
  id: string;
  label: string;
  description: string;
  badge?: string;
  route?: string[];
  available: boolean;
};

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css'
})
export class HomePageComponent {
  protected readonly classicMode = signal<'country-to-flag' | 'flag-to-country'>('country-to-flag');

  protected readonly quizGames: HomeGame[] = [
    {
      id: 'flag-chrono',
      label: 'Chrono drapeaux',
      description: 'Enchaîne les bonnes réponses avant la fin du temps.',
      badge: 'Nouveau',
      route: ['/jeu/chrono-drapeaux'],
      available: true
    },
    {
      id: 'flag-culture',
      label: 'Culture drapeaux',
      description: "Questions sur l'histoire, les évolutions et anecdotes des drapeaux.",
      badge: 'Nouveau',
      route: ['/jeu/culture-drapeaux'],
      available: true
    }
  ];

  protected readonly visualGames: HomeGame[] = [
    {
      id: 'find-the-error',
      label: "Trouver l'erreur",
      description: 'Clique sur la mauvaise zone du drapeau modifié.',
      route: ['/jeu/trouver-erreur'],
      available: true
    },
    {
      id: 'pixel-flag',
      label: 'Le drapeau pixelisé',
      description: "Devine le pays à partir d'un drapeau de plus en plus net.",
      badge: 'Nouveau',
      route: ['/jeu/drapeau-pixelise'],
      available: true
    },
    {
      id: 'flag-rebuild',
      label: 'Reconstruction de drapeau',
      description: 'Choisis la bonne forme puis recolorie chaque zone du drapeau.',
      route: ['/jeu/reconstruction-drapeau'],
      available: true
    }
  ];

  protected setClassicMode(mode: string): void {
    if (mode === 'country-to-flag' || mode === 'flag-to-country') {
      this.classicMode.set(mode);
    }
  }

  protected getClassicRoute(difficulty: 'easy' | 'hard'): string[] {
    if (this.classicMode() === 'country-to-flag') {
      return ['/jeu/pays-vers-drapeaux', difficulty];
    }

    return ['/jeu/drapeaux-vers-pays', difficulty];
  }
}



