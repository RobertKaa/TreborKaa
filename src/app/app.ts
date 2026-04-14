import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  host: {
    '[class.theme-dark]': 'isDarkTheme()'
  },
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  protected readonly isDarkTheme = signal(this.readInitialTheme());
  protected readonly themeLabel = computed(() => (this.isDarkTheme() ? 'Mode clair' : 'Mode sombre'));

  protected toggleTheme(): void {
    this.isDarkTheme.update((value) => !value);
    this.persistTheme();
  }

  protected closeMenu(menu: HTMLDetailsElement): void {
    menu.open = false;
  }

  private readInitialTheme(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const stored = window.localStorage.getItem('ftf-theme');
    if (stored === 'dark') {
      return true;
    }

    if (stored === 'light') {
      return false;
    }

    return this.prefersDark;
  }

  private persistTheme(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('ftf-theme', this.isDarkTheme() ? 'dark' : 'light');
  }
}
