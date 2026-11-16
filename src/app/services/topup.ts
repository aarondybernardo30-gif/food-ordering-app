import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { TopUpModalComponent } from '../components/top-up-modal/top-up-modal.component';
import { AuthService } from './auth';
import { CloudSyncService } from './cloud-sync';

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

@Injectable({
  providedIn: 'root'
})
export class TopUpService {
  private modalCtrl = inject(ModalController);
  private auth = inject(AuthService);
  private cloudSync = inject(CloudSyncService);

  private requestsSubject = new BehaviorSubject<TopUpRequest[]>(this.read());
  public requests$: Observable<TopUpRequest[]> = this.requestsSubject.asObservable();

  constructor() {
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

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === REQUESTS_KEY && Array.isArray(data)) {
        this.requestsSubject.next(data);
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
    this.cloudSync.pushKey(REQUESTS_KEY, list);
    return request;
  }

  approveRequest(id: string): TopUpRequest | null {
    const list = this.read();
    const req = list.find(r => r.id === id) || null;
    if (!req || req.status !== 'Pending') return req;
    req.status = 'Approved';
    this.requestsSubject.next(list);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
    this.cloudSync.pushKey(REQUESTS_KEY, list);
    return req;
  }

  declineRequest(id: string): void {
    const list = this.read().map(r =>
      r.id === id && r.status === 'Pending' ? { ...r, status: 'Declined' as const } : r
    );
    this.requestsSubject.next(list);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
    this.cloudSync.pushKey(REQUESTS_KEY, list);
  }
}