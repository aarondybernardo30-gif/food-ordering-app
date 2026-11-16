import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CloudSyncService } from './cloud-sync';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private cloudSync = inject(CloudSyncService);

  private readonly BALANCE_KEY = 'wallet_balance';
  private readonly COINS_KEY = 'wallet_coins';

  private readonly LEGACY_BALANCE_KEY = 'shopeepay_balance';
  private readonly LEGACY_COINS_KEY = 'shopee_coins';

  private balanceSubject: BehaviorSubject<number>;
  public balance$: Observable<number>;

  private coinsSubject: BehaviorSubject<number>;
  public coins$: Observable<number>;

  constructor() {
    this.balanceSubject = new BehaviorSubject<number>(this.readInitialBalance());
    this.balance$ = this.balanceSubject.asObservable();

    this.coinsSubject = new BehaviorSubject<number>(this.readInitialCoins());
    this.coins$ = this.coinsSubject.asObservable();

    window.addEventListener('storage', (e) => {
      if (e.key === this.BALANCE_KEY && e.newValue !== null) {
        const parsed = parseFloat(e.newValue);
        if (!isNaN(parsed)) {
          this.balanceSubject.next(parsed);
        }
      }
      if (e.key === this.COINS_KEY && e.newValue !== null) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed)) {
          this.coinsSubject.next(parsed);
        }
      }
    });

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === this.BALANCE_KEY) {
        const parsed = typeof data === 'number' ? data : parseFloat(String(data));
        if (!isNaN(parsed)) {
          this.balanceSubject.next(parsed);
        }
      }
      if (key === this.COINS_KEY) {
        const parsed = typeof data === 'number' ? data : parseInt(String(data), 10);
        if (!isNaN(parsed)) {
          this.coinsSubject.next(parsed);
        }
      }
    });
  }

  private readInitialBalance(): number {
    const saved = localStorage.getItem(this.BALANCE_KEY) ?? localStorage.getItem(this.LEGACY_BALANCE_KEY);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) {
        localStorage.setItem(this.BALANCE_KEY, String(parsed));
        return parsed;
      }
    }
    return 2500.0;
  }

  private readInitialCoins(): number {
    const saved = localStorage.getItem(this.COINS_KEY) ?? localStorage.getItem(this.LEGACY_COINS_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) {
        localStorage.setItem(this.COINS_KEY, String(parsed));
        return parsed;
      }
    }
    return 150;
  }

  getBalance(): number {
    return this.balanceSubject.value;
  }

  getCoins(): number {
    return this.coinsSubject.value;
  }

  topUp(amount: number): void {
    if (!(amount > 0)) {
      return;
    }
    const newBalance = this.balanceSubject.value + amount;
    this.balanceSubject.next(newBalance);
    localStorage.setItem(this.BALANCE_KEY, newBalance.toString());
    this.cloudSync.pushKey(this.BALANCE_KEY, newBalance);
  }

  deduct(amount: number): boolean {
    if (!(amount > 0) || amount > this.balanceSubject.value) {
      return false;
    }
    const newBalance = this.balanceSubject.value - amount;
    this.balanceSubject.next(newBalance);
    localStorage.setItem(this.BALANCE_KEY, newBalance.toString());
    this.cloudSync.pushKey(this.BALANCE_KEY, newBalance);
    return true;
  }
}