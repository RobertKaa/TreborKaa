// Logger utilitaire simple. N'affiche les logs que si on détecte un environnement de
// développement (localhost, 127.* ou file://). En production, les appels sont silencieux
// pour éviter de polluer la console et potentiellement exposer des données.
export const logger = {
  isProduction(): boolean {
    try {
      if (typeof window === 'undefined' || !window.location) return false;
      const host = window.location.hostname || '';
      if (host === 'localhost' || host.startsWith('127.') || host === '') return false;
      return true;
    } catch {
      return false;
    }
  },

  error(...args: unknown[]): void {
    if (!this.isProduction()) {
      // eslint-disable-next-line no-console
      console.error(...args);
    }
    // En production, on pourrait poster le message vers un service distant ici.
  },

  warn(...args: unknown[]): void {
    if (!this.isProduction()) {
      // eslint-disable-next-line no-console
      console.warn(...args);
    }
  },

  info(...args: unknown[]): void {
    if (!this.isProduction()) {
      // eslint-disable-next-line no-console
      console.info(...args);
    }
  },

  debug(...args: unknown[]): void {
    if (!this.isProduction()) {
      // eslint-disable-next-line no-console
      console.debug(...args);
    }
  },
};

