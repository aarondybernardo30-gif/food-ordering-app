import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { TopUpModalComponent } from '../components/top-up-modal/top-up-modal.component';
import { AuthService } from './auth';

export interface TopUpRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  reference: string;
  createdAt: string;
  status: 'Pending' | 'Approved' | 'Declined';
}

const REQUESTS_KEY = 'app_topup_requests';

/**
 * Wallet Top Up flow: opens the amount + store-QR modal, and records
 * payment confirmations as requests that the ADMIN approves before the
 * customer's wallet is credited.
 */
@Injectable({
  providedIn: 'root'
})
export class TopUpService {
  private modalCtrl = inject(ModalController);
  private auth = inject(AuthService);

  private requestsSubject = new BehaviorSubject<TopUpRequest[]>(this.read());
  public requests$: Observable<TopUpRequest[]> = this.requestsSubject.asObservable();

  constructor() {
    // Sync when requests change in another tab (admin <-> customer).
    window.addEventListener('storage', (e) => {
      if (e.key === REQUESTS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            this.requestsSubject.next(parsed);
          }
        } catch {}
      }
    });
  }

  private read(): TopUpRequest[] {
    try {
      const data = localStorage.getItem(REQUESTS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  getRequests(): TopUpRequest[] {
    return this.requestsSubject.value;
  }

  async present(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: TopUpModalComponent,
      cssClass: 'top-up-dialog-modal',
      backdropDismiss: true
    });
    return modal.present();
  }

  /**
   * Customer tapped "I Have Completed the Payment" — the wallet is NOT
   * credited yet; the request waits for admin confirmation.
   */
  submitPaymentRequest(amount: number, reference: string): TopUpRequest {
    const user = this.auth.getCurrentUser();
    const request: TopUpRequest = {
      id: 'TUR-' + Date.now().toString().slice(-8),
      customerName: user?.fullName || 'Customer',
      customerPhone: user?.phone || '',
      amount,
      reference,
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };
    const list = [request, ...this.read()];
    this.requestsSubject.next(list);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
    return request;
  }

  /** Admin approved — the wallet gets credited (same device storage). */
  approveRequest(id: string): TopUpRequest | null {
    const list = this.read();
    const req = list.find(r => r.id === id) || null;
    if (!req || req.status !== 'Pending') return req;
    req.status = 'Approved';
    this.requestsSubject.next(list);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
    return req;
  }

  declineRequest(id: string): void {
    const list = this.read().map(r =>
      r.id === id && r.status === 'Pending' ? { ...r, status: 'Declined' as const } : r
    );
    this.requestsSubject.next(list);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
  }
}
