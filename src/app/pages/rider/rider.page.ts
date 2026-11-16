import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButton,
  IonIcon,
  IonBadge,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  ToastController,
  AlertController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  bicycleOutline,
  navigateOutline,
  checkmarkDoneOutline,
  locationOutline,
  personCircleOutline
} from 'ionicons/icons';
import { Order, Rider } from '../../models/food.model';
import { OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-rider',
  templateUrl: './rider.page.html',
  styleUrls: ['./rider.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButton,
    IonIcon,
    IonBadge,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonLabel
  ]
})
export class RiderPage implements OnInit {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  selectedSegment: 'active' | 'delivered' = 'active';
  currentRider: Rider | null = null;
  assignedOrders: Order[] = [];

  constructor() {
    addIcons({
      logOutOutline,
      bicycleOutline,
      navigateOutline,
      checkmarkDoneOutline,
      locationOutline,
      personCircleOutline
    });
  }

  ngOnInit() {
    this.loadCurrentRider();
    this.loadAndFilterOrders();

    this.orderService.orders$.subscribe(allOrders => {
      this.filterMyOrders(allOrders);
    });
  }

  ionViewWillEnter() {
    this.loadCurrentRider();
    this.loadAndFilterOrders();
  }

  get activeOrders(): Order[] {
    return this.assignedOrders.filter(o => o.status !== 'Completed');
  }

  get deliveredOrders(): Order[] {
    return this.assignedOrders.filter(o => o.status === 'Completed');
  }

  private loadCurrentRider() {
    try {
      const stored = localStorage.getItem('current_rider');
      if (stored) {
        this.currentRider = JSON.parse(stored);
      } else {
        this.router.navigate(['/rider-auth']);
      }
    } catch {
      this.router.navigate(['/rider-auth']);
    }
  }

  private loadAndFilterOrders() {
    const keys = ['app_orders', 'food_orders', 'orders'];
    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const list: Order[] = Array.isArray(parsed) ? parsed : (parsed.orders || []);
          if (list.length > 0) {
            this.filterMyOrders(list);
            break;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  // Filters orders to show ONLY those assigned to this rider's phone or name
  private filterMyOrders(orders: Order[]) {
    if (!this.currentRider) return;

    const myPhone = (this.currentRider.phone || '').trim();
    const myName = (this.currentRider.fullName || '').trim().toLowerCase();
    const myUsername = (this.currentRider.username || '').trim().toLowerCase();

    this.assignedOrders = orders.filter(order => {
      const orderRiderPhone = (order.assignedRiderPhone || '').trim();
      const orderRiderName = (order.assignedRiderName || '').trim().toLowerCase();

      const phoneMatch = myPhone && orderRiderPhone && myPhone === orderRiderPhone;
      const nameMatch = myName && orderRiderName && (myName === orderRiderName || orderRiderName.includes(myName));
      const userMatch = myUsername && orderRiderName && orderRiderName === myUsername;

      return phoneMatch || nameMatch || userMatch;
    });
  }

  // --- GPS NAVIGATION ---
  openNavigation(order?: Order) {
    const targetOrder = order || this.activeOrders[0];
    if (!targetOrder) return;

    if (targetOrder.latitude && targetOrder.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${targetOrder.latitude},${targetOrder.longitude}`,
        '_blank'
      );
    } else if (targetOrder.deliveryAddress) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetOrder.deliveryAddress)}`,
        '_blank'
      );
    }
  }

  trackExactLocation(order?: Order) {
    this.openNavigation(order);
  }

  // --- SET AS DELIVERED ---
  async setDelivered(order?: Order) {
    const targetOrder = order || this.activeOrders[0];
    if (!targetOrder) return;

    this.orderService.updateOrderStatus(targetOrder.id, 'Completed');

    const keys = ['app_orders', 'food_orders', 'orders'];
    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const list: Order[] = Array.isArray(parsed) ? parsed : (parsed.orders || []);
          const idx = list.findIndex(o => o.id === targetOrder.id);
          if (idx !== -1) {
            list[idx].status = 'Completed';
            localStorage.setItem(key, JSON.stringify(list));
          }
        } catch (e) {}
      }
    }

    targetOrder.status = 'Completed';

    const toast = await this.toastCtrl.create({
      message: `Order #${targetOrder.id} marked as Delivered! Great job!`,
      duration: 2500,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }

  completeDelivery(order?: Order) {
    this.setDelivered(order);
  }

  markDelivered(order?: Order) {
    this.setDelivered(order);
  }

  // --- LOGOUT ---
  async onRiderLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Rider Sign Out',
      message: 'Are you sure you want to log out of your rider account?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign Out',
          role: 'destructive',
          handler: () => {
            this.authService.riderLogout();
            this.router.navigate(['/rider-auth']);
          }
        }
      ]
    });
    await alert.present();
  }

  logoutRider() {
    this.onRiderLogout();
  }
}