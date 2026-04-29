import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BrowserStorageService {
  getString(key: string): string | null {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }

    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  setString(key: string, value: string): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(key, value);
    } catch {
      // Ignore storage errors.
    }
  }

  getJson<T>(key: string, fallback: T): T {
    const raw = this.getString(key);
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed === null ? fallback : (parsed as T);
    } catch {
      return fallback;
    }
  }

  setJson<T>(key: string, value: T): void {
    this.setString(key, JSON.stringify(value));
  }

  remove(key: string): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage errors.
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
}
