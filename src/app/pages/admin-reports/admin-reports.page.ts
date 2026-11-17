import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonTitle,
  IonContent
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  statsChartOutline,
  cashOutline,
  receiptOutline,
  checkmarkDoneOutline,
  timeOutline,
  pulseOutline,
  restaurantOutline,
  documentTextOutline
} from 'ionicons/icons';
import { OrderService } from '../../services/order';
import { Order } from '../../models/food.model';

interface StatusRow {
  label: string;
  count: number;
  percent: number;
  cls: string;
}

@Component({
  selector: 'app-admin-reports',
  templateUrl: './admin-reports.page.html',
  styleUrls: ['./admin-reports.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonTitle,
    IonContent
  ]
})
export class AdminReportsPage implements OnInit {
  private orderService = inject(OrderService);
  private router = inject(Router);

  orders: Order[] = [];

  totalOrders = 0;
  totalRevenue = 0;
  completedCount = 0;
  activeCount = 0;
  avgOrderValue = 0;

  statusRows: StatusRow[] = [];
  topItems: { name: string; qty: number }[] = [];
  recentOrders: Order[] = [];

  constructor() {
    addIcons({
      arrowBackOutline,
      statsChartOutline,
      cashOutline,
      receiptOutline,
      checkmarkDoneOutline,
      timeOutline,
      pulseOutline,
      restaurantOutline,
      documentTextOutline
    });
  }

  ngOnInit() {
    this.orderService.orders$.subscribe((data) => {
      this.orders = data || [];
      this.buildReport();
    });
  }

  goBackToDashboard() {
    this.router.navigate(['/admin']);
  }

  private buildReport() {
    const orders = this.orders;
    this.totalOrders = orders.length;
    this.totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    this.completedCount = orders.filter((o) => o.status === 'Completed').length;
    this.activeCount = orders.filter((o) => o.status !== 'Completed').length;
    this.avgOrderValue = this.totalOrders > 0 ? this.totalRevenue / this.totalOrders : 0;

    // Orders by status
    const statusLabels: { key: Order['status']; label: string; cls: string }[] = [
      { key: 'Pending', label: 'Pending', cls: 'pending' },
      { key: 'Preparing', label: 'Preparing', cls: 'preparing' },
      { key: 'Out for Delivery', label: 'Out for Delivery', cls: 'delivery' },
      { key: 'Ready for Pickup', label: 'Ready for Pickup', cls: 'pickup' },
      { key: 'Completed', label: 'Completed', cls: 'completed' }
    ];
    this.statusRows = statusLabels
      .map(({ key, label, cls }) => {
        const count = orders.filter((o) => o.status === key).length;
        return {
          label,
          count,
          cls,
          percent: this.totalOrders > 0 ? Math.round((count / this.totalOrders) * 100) : 0
        };
      })
      .filter((row) => row.count > 0);

    // Top selling items
    const qtyByName = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items || []) {
        const name = item.food?.name || 'Unknown item';
        qtyByName.set(name, (qtyByName.get(name) || 0) + (item.quantity || 0));
      }
    }
    this.topItems = Array.from(qtyByName.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Recent orders (newest first)
    this.recentOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }
}
