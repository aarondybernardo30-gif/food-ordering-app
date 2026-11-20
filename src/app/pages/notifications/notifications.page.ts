import { Component, OnInit, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonBadge
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  notificationsOutline,
  notificationsOffOutline,
  fastFoodOutline,
  bicycleOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  timeOutline,
  starOutline,
  restaurantOutline
} from 'ionicons/icons';
import { OrderService } from '../../services/order';
import { CustomerOrderHistoryService } from '../../services/customer-order-history';
import { ThemeService } from '../../services/theme.service';
import { Order } from '../../models/food.model';
import { UserBottomNavComponent } from '../../user-bottom-nav/user-bottom-nav.component';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonBadge,
    UserBottomNavComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class NotificationsPage implements OnInit {
  private orderService = inject(OrderService);
  private customerOrderHistory = inject(CustomerOrderHistoryService);
  private router = inject(Router);
  public themeService = inject(ThemeService);

  orders: Order[] = [];
  isDarkMode: boolean = false;

  constructor() {
    addIcons({
      notificationsOutline,
      notificationsOffOutline,
      fastFoodOutline,
      bicycleOutline,
      checkmarkCircleOutline,
      chevronForwardOutline,
      timeOutline,
      starOutline,
      restaurantOutline
    });
  }

  ngOnInit() {
    // Dark mode — follows the app-wide ThemeService (Me page toggle)
    this.themeService.isDarkMode$.subscribe((dark) => {
      this.isDarkMode = dark;
    });

    if (this.orderService && this.orderService.orders$) {
      this.customerOrderHistory.orders$.subscribe((data: Order[]) => {
        this.orders = data || [];
      });
    }
  }

  goToOrderAction(_order?: Order) {
    this.router.navigate(['/me']);
  }
}
