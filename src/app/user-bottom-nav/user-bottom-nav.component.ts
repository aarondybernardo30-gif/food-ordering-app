import { Component, Input, OnInit, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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

  notificationCount: number = 0;

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
        this.notificationCount = orders.filter(
          (o: any) => o.status !== 'Completed' || (o.status === 'Completed' && !o.rating)
        ).length;
      });
    }
  }

  switchTab(tab: 'home' | 'notifications' | 'me') {
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