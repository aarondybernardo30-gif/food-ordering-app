import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CloudSyncService } from './cloud-sync';

export interface PromoFeature {
  id: string;
  placement: 'hero' | 'side';
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  badge?: string;
  badgeColor?: string;
  tag?: string;
  actionText?: string;
}

const STORAGE_KEY = 'app_promos';

const SEED_FEATURES: PromoFeature[] = [
  {
    id: 'promo_hero_1',
    placement: 'hero',
    title: '50% Off First Order',
    subtitle: 'Use code WELCOME50 at checkout',
    badge: 'PROMO',
    badgeColor: 'warning',
    tag: 'Limited Offer',
    actionText: 'Claim Now',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000'
  },
  {
    id: 'promo_hero_2',
    placement: 'hero',
    title: 'Free Delivery Special',
    subtitle: 'On all orders above ₱300',
    badge: 'FREE DELIVERY',
    badgeColor: 'success',
    tag: 'Weekend Feast',
    actionText: 'Order Now',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000'
  },
  {
    id: 'promo_side_1',
    placement: 'side',
    title: 'Free Shipping + ₱50 OFF',
    description: 'On all crispy chicken combos',
    badge: 'LIMITED VOUCHER',
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop'
  },
  {
    id: 'promo_side_2',
    placement: 'side',
    title: 'Up to 20% Instant Cashback',
    description: 'Pay with wallet on your next meal',
    badge: 'WALLET DEAL',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop'
  }
];

@Injectable({
  providedIn: 'root'
})
export class FeatureService {
  private cloudSync = inject(CloudSyncService);

  private featuresSubject = new BehaviorSubject<PromoFeature[]>(this.readFeatures());
  public features$: Observable<PromoFeature[]> = this.featuresSubject.asObservable();

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            this.featuresSubject.next(parsed);
          }
        } catch {}
      }
    });

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === STORAGE_KEY && Array.isArray(data)) {
        this.featuresSubject.next(data);
      }
    });
  }

  private readFeatures(): PromoFeature[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_FEATURES));
    return SEED_FEATURES;
  }

  getFeatures(): PromoFeature[] {
    return this.featuresSubject.value;
  }

  addFeature(feature: Omit<PromoFeature, 'id'> & { id?: string }): void {
    const created: PromoFeature = { ...feature, id: feature.id || 'promo_' + Date.now() };
    const updated = [created, ...this.featuresSubject.value];
    this.featuresSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.cloudSync.pushKey(STORAGE_KEY, updated);
  }

  updateFeature(feature: PromoFeature): void {
    const updated = this.featuresSubject.value.map(f =>
      f.id === feature.id ? { ...feature } : f
    );
    this.featuresSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.cloudSync.pushKey(STORAGE_KEY, updated);
  }

  deleteFeature(id: string): void {
    const updated = this.featuresSubject.value.filter(f => f.id !== id);
    this.featuresSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.cloudSync.pushKey(STORAGE_KEY, updated);
  }
}