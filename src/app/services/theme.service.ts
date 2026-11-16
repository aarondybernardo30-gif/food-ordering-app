import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Single source of truth for the app-wide Dark Mode toggle.
 * The Me page hosts the toggle; Menu and Notifications follow
 * automatically through isDarkMode$.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app_dark_mode';
  /** Legacy key written by the Me page's old toggle; kept in sync for compatibility. */
  private readonly LEGACY_KEY = 'me_dark_mode';

  private darkModeSubject = new BehaviorSubject<boolean>(this.readInitial());
  public isDarkMode$: Observable<boolean> = this.darkModeSubject.asObservable();

  constructor() {
    if (this.darkModeSubject.value) {
      document.body.classList.add('dark');
    }
  }

  private readInitial(): boolean {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
      // First run after migrating from the old per-page toggle.
      const legacy = localStorage.getItem(this.LEGACY_KEY);
      if (legacy === 'true') {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        return true;
      }
    } catch {}
    return false;
  }

  get isDarkMode(): boolean {
    return this.darkModeSubject.value;
  }

  setDarkMode(value: boolean) {
    this.darkModeSubject.next(value);
    document.body.classList.toggle('dark', value);
    localStorage.setItem(this.STORAGE_KEY, String(value));
    localStorage.setItem(this.LEGACY_KEY, String(value));
  }

  toggleDarkMode(): boolean {
    this.setDarkMode(!this.darkModeSubject.value);
    return this.darkModeSubject.value;
  }
}
