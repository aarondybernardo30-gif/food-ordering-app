import { Component, Input, OnInit, inject, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon, IonBadge } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  home,
  homeOutline,
  notifications,
  notificationsOutline,
  person,
  personOutline
} from 'ionicons/icons';
import { OrderService } from '../services/order';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-user-bottom-nav',
  templateUrl: './user-bottom-nav.component.html',
  styleUrls: ['./user-bottom-nav.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonBadge],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class UserBottomNavComponent implements OnInit {
  @Input() activeTab: 'home' | 'notifications' | 'me' = 'home';

  private router = inject(Router);
  private orderService = inject(OrderService, { optional: true });
  private authService = inject(AuthService, { optional: true });
  private cdr = inject(ChangeDetectorRef);

  notificationCount: number = 0;
  private latestOrders: any[] = [];

  constructor() {
    addIcons({
      home,
      homeOutline,
      notifications,
      notificationsOutline,
      person,
      personOutline
    });
  }

  ngOnInit() {
    if (this.orderService && this.orderService.orders$) {
      this.orderService.orders$.subscribe(orders => {
        this.latestOrders = orders || [];

        if (this.activeTab === 'notifications') {
          this.markNotificationsAsSeen();
        } else {
          this.updateUnreadCount();
        }
        this.cdr.detectChanges();
      });
    }
  }

  private getStorageKey(): string {
    const user = this.authService?.getCurrentUser?.();
    const userKey = (user && (user.phone || user.fullName)) || 'guest';
    return `seen_notifications_${userKey}`;
  }

  private getRelevantOrders(orders: any[]): any[] {
    return (orders || []).filter(
      (o: any) => o.status !== 'Completed' || (o.status === 'Completed' && !o.rating)
    );
  }

  private notifKey(order: any): string {
    return `${order?.id}:${order?.status || ''}`;
  }

  private getSeenKeys(): Set<string> {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set<string>();
    }
  }

  private markNotificationsAsSeen() {
    const seen = this.getSeenKeys();
    for (const o of this.getRelevantOrders(this.latestOrders)) {
      seen.add(this.notifKey(o));
    }
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(Array.from(seen)));
    } catch {}
    this.notificationCount = 0;
  }

  private updateUnreadCount() {
    const seen = this.getSeenKeys();
    this.notificationCount = this.getRelevantOrders(this.latestOrders).filter(
      (o: any) => !seen.has(this.notifKey(o))
    ).length;
  }

  switchTab(tab: 'home' | 'notifications' | 'me') {
    if (tab === 'notifications') {
      this.markNotificationsAsSeen();
      this.cdr.detectChanges();
    }

    if (this.activeTab === tab) return;

    if (tab === 'home') {
      // Navigates directly to your main Menu page
      this.router.navigate(['/menu']);
    } else if (tab === 'notifications') {
      this.router.navigate(['/notifications']);
    } else if (tab === 'me') {
      this.router.navigate(['/me']);
    }
  }
}