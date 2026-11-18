import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Order } from '../models/food.model';
import { FoodService } from './food';
import { CloudSyncService } from './cloud-sync';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private foodService = inject(FoodService);
  private cloudSync = inject(CloudSyncService);

  private readonly STORAGE_KEY = 'app_orders';
  private readonly LEGACY_STORAGE_KEY = 'food_orders';

  private ordersSubject = new BehaviorSubject<Order[]>(this.getStoredOrders());
  public orders$: Observable<Order[]> = this.ordersSubject.asObservable();

  constructor() {
    window.addEventListener('storage', (e) => {
      if ((e.key === this.STORAGE_KEY || e.key === this.LEGACY_STORAGE_KEY) && e.newValue) {
        try {
          this.ordersSubject.next(this.normalizeOrders(JSON.parse(e.newValue)));
        } catch {}
      }
    });

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === this.STORAGE_KEY && Array.isArray(data)) {
        this.ordersSubject.next(this.normalizeOrders(data));
      }
    });
  }

  private normalizeOrders(orders: Order[]): Order[] {
    return (orders || []).map((order) => ({
      ...order,
      paymentMethod: order.paymentMethod === ('wallet' as any) ? 'shopeepay' : order.paymentMethod
    }));
  }

  getStoredOrders(): Order[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY) || localStorage.getItem(this.LEGACY_STORAGE_KEY);
      return data ? this.normalizeOrders(JSON.parse(data)) : [];
    } catch {
      return [];
    }
  }

  private async saveToStorage(orders: Order[]): Promise<void> {
    const compacted = this.compactForStorage(orders);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(compacted));
    } catch {
      let trimmed = compacted;
      while (trimmed.length > 5) {
        trimmed = trimmed.slice(0, Math.ceil(trimmed.length / 2));
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
          break;
        } catch {}
      }
    }
    this.ordersSubject.next(orders);
    await this.cloudSync.pushKey(this.STORAGE_KEY, compacted);
  }

  private compactForStorage(orders: Order[]): Order[] {
    return orders.map(order => ({
      ...order,
      items: (order.items || []).map(item => {
        if (!item.food) return item;
        const food: any = { ...item.food };
        if (
          typeof food.imageUrl === 'string' &&
          food.imageUrl.startsWith('data:') &&
          food.imageUrl.length > 20000
        ) {
          food.imageUrl = this.makeThumb(food.imageUrl);
        }
        delete food.images;
        return { ...item, food };
      })
    }));
  }

  private makeThumb(dataUrl: string): string {
    try {
      const img = new Image();
      img.src = dataUrl;
      if (!img.complete || img.naturalWidth === 0) return '';
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 120 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return '';
    }
  }

  async createOrder(order: Order): Promise<void> {
    const orders = this.getStoredOrders();
    orders.unshift(order);
    await this.saveToStorage(orders);

    // Decrease available orders (stock) & increase sold today (soldCount)
    if (order.items && order.items.length > 0) {
      await this.foodService.recordOrderItems(order.items);
    }
  }

  async addOrder(order: Order): Promise<void> {
    await this.createOrder(order);
  }

  async updateOrderStatus(orderId: string, status: Order['status'] | string): Promise<void> {
    const orders = this.getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = status as any;
      await this.saveToStorage(orders);
    }
  }

  async assignRider(orderId: string, riderName: string, riderPhone: string): Promise<void> {
    const orders = this.getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.assignedRiderName = riderName;
      order.assignedRiderPhone = riderPhone;
      order.status = 'Out for Delivery';
      await this.saveToStorage(orders);
    }
  }

  async submitOrderReview(orderId: string, rating: number, feedback: string): Promise<void> {
    const orders = this.getStoredOrders();
    const targetOrder = orders.find(o => o.id === orderId);

    if (targetOrder) {
      targetOrder.rating = rating;
      targetOrder.feedback = feedback;
      targetOrder.reviewedAt = new Date();
      await this.saveToStorage(orders);

      if (targetOrder.items && targetOrder.items.length > 0) {
        const reviewedFoodIds = new Set<string>();
        for (const item of targetOrder.items) {
          const fid = item.food?.id;
          if (fid === undefined || fid === null) continue;
          const key = String(fid);
          if (reviewedFoodIds.has(key)) continue;
          reviewedFoodIds.add(key);

          await this.foodService.addReviewToFood(fid, {
            id: Math.random().toString(36).substring(2, 9),
            foodId: fid,
            customerName: targetOrder.customerName || 'Verified Customer',
            rating: rating,
            comment: feedback || 'Great food!',
            createdAt: new Date()
          });
        }
      }
    }
  }

  /** Proof of Delivery: attach the rider's photo and mark the order Completed. */
  async submitDeliveryProof(orderId: string, proofDataUrl: string): Promise<void> {
    const orders = this.getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.deliveryProof = proofDataUrl;
      order.deliveredAt = new Date();
      order.status = 'Completed';
      await this.saveToStorage(orders);
    }
  }
}