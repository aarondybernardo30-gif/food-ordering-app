import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CloudSyncService } from './cloud-sync';

export interface WalletQrSettings {
  image: string;
  walletLabel: string;
  accountName: string;
  accountNumber: string;
  city: string;
}

const STORAGE_KEY = 'app_wallet_qr';
const DEFAULTS: WalletQrSettings = {
  image: '',
  walletLabel: 'GCash',
  accountName: '',
  accountNumber: '',
  city: 'Manila'
};

@Injectable({
  providedIn: 'root'
})
export class WalletQrService {
  private cloudSync = inject(CloudSyncService);

  private settingsSubject = new BehaviorSubject<WalletQrSettings>(this.read());
  public settings$: Observable<WalletQrSettings> = this.settingsSubject.asObservable();

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            this.settingsSubject.next({ ...DEFAULTS, ...parsed });
          }
        } catch {}
      }
    });

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === STORAGE_KEY && data && typeof data === 'object') {
        this.settingsSubject.next({ ...DEFAULTS, ...data });
      }
    });
  }

  private read(): WalletQrSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULTS, ...parsed };
        }
      }
    } catch {}
    return { ...DEFAULTS };
  }

  getSettings(): WalletQrSettings {
    return this.settingsSubject.value;
  }

  update(settings: WalletQrSettings): void {
    const copy = { ...settings };
    this.settingsSubject.next(copy);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
    this.cloudSync.pushKey(STORAGE_KEY, copy);
  }

  hasRealQr(): boolean {
    return !!this.settingsSubject.value.image;
  }
}