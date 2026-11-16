import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Rider, User } from '../models/food.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Customer session keys
  private readonly USER_KEY = 'currentUser';
  private readonly USERS_LIST_KEY = 'registered_users';

  // Admin session keys
  private readonly ADMIN_KEY = 'admin_session';
  private readonly ADMINS_LIST_KEY = 'registered_admins';

  // Rider session keys
  private readonly RIDER_KEY = 'current_rider';
  private readonly RIDERS_LIST_KEY = 'registered_riders';

  /** Built-in accounts referenced by the sign-in screens' hints. */
  private readonly DEFAULT_ADMIN = {
    fullName: 'Master Admin',
    username: 'admin',
    password: 'admin123'
  };
  private readonly DEFAULT_RIDER: Rider = {
    id: 'rider_default',
    fullName: 'Demo Rider',
    username: 'rider',
    phone: '09100000000',
    password: 'rider123'
  };

  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor() {
    let savedUser: User | null = null;
    try {
      const data = localStorage.getItem(this.USER_KEY);
      if (data) {
        savedUser = JSON.parse(data);
      }
    } catch {
      savedUser = null;
    }
    this.currentUserSubject = new BehaviorSubject<User | null>(savedUser);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.seedDefaultAccounts();
  }

  /** Makes sure the advertised default admin & rider accounts exist exactly once. */
  private seedDefaultAccounts(): void {
    try {
      const admins = this.readList(this.ADMINS_LIST_KEY);
      if (!admins.some((a) => a.username === this.DEFAULT_ADMIN.username)) {
        admins.push({ ...this.DEFAULT_ADMIN });
        localStorage.setItem(this.ADMINS_LIST_KEY, JSON.stringify(admins));
      }

      const riders = this.readList(this.RIDERS_LIST_KEY);
      if (!riders.some((r) => r.username === this.DEFAULT_RIDER.username)) {
        riders.push({ ...this.DEFAULT_RIDER });
        localStorage.setItem(this.RIDERS_LIST_KEY, JSON.stringify(riders));
      }
    } catch {}
  }

  private readList(key: string): any[] {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry) => entry && typeof entry === 'object');
        }
      }
    } catch {}
    return [];
  }

  // ==========================================
  // 1. CUSTOMER AUTHENTICATION
  // ==========================================

  isUserLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  getCurrentUser(): User | null {
    if (this.currentUserSubject.value) {
      return this.currentUserSubject.value;
    }
    try {
      const data = localStorage.getItem(this.USER_KEY);
      if (data) {
        const user: User = JSON.parse(data);
        this.currentUserSubject.next(user);
        return user;
      }
    } catch {}
    return null;
  }

  getRegisteredUsers(): User[] {
    return this.readList(this.USERS_LIST_KEY);
  }

  /**
   * Creates a customer account. Returns false when the phone number is
   * already registered so the Sign Up screen can ask the user to sign in.
   */
  register(userData: Partial<User> & { name?: string }): boolean {
    const phone = (userData.phone || '').trim();
    if (!phone) {
      return false;
    }

    const registeredUsers = this.getRegisteredUsers();
    const phoneTaken = registeredUsers.some((u) => (u.phone || '').trim() === phone);
    if (phoneTaken) {
      return false;
    }

    const newUser: User = {
      fullName: (userData.fullName || userData.name || 'Guest').trim(),
      phone,
      email: userData.email || undefined,
      password: userData.password || ''
    };

    registeredUsers.push(newUser);
    localStorage.setItem(this.USERS_LIST_KEY, JSON.stringify(registeredUsers));
    return true;
  }

  /**
   * Signs a customer in with phone (or email) + password.
   * Only exact matches against registered accounts are accepted.
   */
  userLogin(phoneOrEmail: string, password: string): boolean {
    const input = (phoneOrEmail || '').trim();
    const pass = password || '';

    if (!input || !pass) {
      return false;
    }

    const foundUser = this.getRegisteredUsers().find((u) => {
      const phoneMatch = (u.phone || '').trim() === input;
      const emailMatch =
        !!u.email && u.email.toLowerCase() === input.toLowerCase();
      return phoneMatch || emailMatch;
    });

    if (!foundUser || foundUser.password !== pass) {
      return false;
    }

    this.setUserSession(foundUser);
    return true;
  }

  logout(): void {
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
  }

  /** Persists profile changes to the active session and the registered list. */
  updateProfile(changes: { fullName?: string; password?: string }): void {
    const current = this.getCurrentUser();
    if (!current) {
      return;
    }

    const updated: User = {
      ...current,
      fullName: changes.fullName?.trim() || current.fullName,
      password: changes.password?.trim() || current.password
    };

    this.setUserSession(updated);

    const users = this.getRegisteredUsers();
    const index = users.findIndex((u) => (u.phone || '').trim() === (current.phone || '').trim());
    if (index !== -1) {
      users[index] = updated;
      localStorage.setItem(this.USERS_LIST_KEY, JSON.stringify(users));
    }
  }

  private setUserSession(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  // ==========================================
  // 2. ADMIN AUTHENTICATION
  // ==========================================

  isAdminLoggedIn(): boolean {
    return localStorage.getItem(this.ADMIN_KEY) === 'true';
  }

  /** Creates an admin account; rejects duplicate usernames. */
  registerAdmin(adminData: { fullName?: string; username: string; password: string }): boolean {
    const username = (adminData.username || '').trim().toLowerCase();
    if (!username) {
      return false;
    }

    const admins = this.readList(this.ADMINS_LIST_KEY);
    if (admins.some((a) => (a.username || '').toLowerCase() === username)) {
      return false;
    }

    admins.push({
      fullName: adminData.fullName || 'Administrator',
      username,
      password: adminData.password || ''
    });
    localStorage.setItem(this.ADMINS_LIST_KEY, JSON.stringify(admins));
    return true;
  }

  /** Signs an admin in; unknown usernames or wrong passwords are rejected. */
  adminLogin(username: string, password: string): boolean {
    const input = (username || '').trim().toLowerCase();
    const pass = password || '';

    if (!input || !pass) {
      return false;
    }

    const foundAdmin = this.readList(this.ADMINS_LIST_KEY).find(
      (a) => (a.username || '').toLowerCase() === input
    );

    if (!foundAdmin || foundAdmin.password !== pass) {
      return false;
    }

    localStorage.setItem(this.ADMIN_KEY, 'true');
    return true;
  }

  adminLogout(): void {
    localStorage.removeItem(this.ADMIN_KEY);
  }

  // ==========================================
  // 3. RIDER AUTHENTICATION
  // ==========================================

  isRiderLoggedIn(): boolean {
    return this.getCurrentRider() !== null;
  }

  getCurrentRider(): Rider | null {
    try {
      const stored = localStorage.getItem(this.RIDER_KEY);
      if (stored) {
        const rider: Rider = JSON.parse(stored);
        if (rider && (rider.phone || rider.username || rider.id)) {
          return rider;
        }
      }
    } catch {}
    return null;
  }

  getRegisteredRiders(): Rider[] {
    return this.readList(this.RIDERS_LIST_KEY);
  }

  /** Creates a rider account; rejects duplicate usernames or phone numbers. */
  registerRider(riderData: Rider & { username: string; password: string }): boolean {
    const username = (riderData.username || '').trim().toLowerCase();
    const phone = (riderData.phone || '').trim();
    if (!username || !phone) {
      return false;
    }

    const riders = this.getRegisteredRiders();
    if (riders.some((r) => (r.username || '').toLowerCase() === username)) {
      return false;
    }
    if (riders.some((r) => (r.phone || '').trim() === phone)) {
      return false;
    }

    riders.push({ ...riderData, username });
    localStorage.setItem(this.RIDERS_LIST_KEY, JSON.stringify(riders));
    return true;
  }

  /** Establishes the rider session after credentials have been verified. */
  setRiderSession(rider: Rider): void {
    localStorage.setItem(this.RIDER_KEY, JSON.stringify(rider));
    localStorage.setItem('is_rider_logged_in', 'true');
  }

  riderLogout(): void {
    localStorage.removeItem(this.RIDER_KEY);
    localStorage.removeItem('is_rider_logged_in');
    localStorage.removeItem('rider_logged_in');
    localStorage.removeItem('rider_session');
  }
}
