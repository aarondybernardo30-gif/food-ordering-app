import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Order } from '../models/food.model';
import { FoodService } from './food';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private foodService = inject(FoodService);
  private readonly STORAGE_KEY = 'app_orders';
  private readonly LEGACY_STORAGE_KEY = 'food_orders';

  private ordersSubject = new BehaviorSubject<Order[]>(this.getStoredOrders());
  public orders$: Observable<Order[]> = this.ordersSubject.asObservable();

  constructor() {
    // Cross-tab synchronization without server polling
    window.addEventListener('storage', (e) => {
      if ((e.key === this.STORAGE_KEY || e.key === this.LEGACY_STORAGE_KEY) && e.newValue) {
        try {
          this.ordersSubject.next(this.normalizeOrders(JSON.parse(e.newValue)));
        } catch {}
      }
    });
  }

  /** Normalizes orders saved by earlier app versions (payment method naming). */
  private normalizeOrders(orders: Order[]): Order[] {
    return (orders || []).map((order) => ({
      ...order,
      // Earlier versions stored the wallet payment as 'wallet'; it is now 'shopeepay'.
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

  /**
   * Orders embed their items' food objects — including any base64 photos.
   * Those photos can push localStorage over the browser quota, which makes
   * saving an order FAIL SILENTLY after the wallet was already charged.
   * Stored orders therefore keep only a small thumbnail of each item's image.
   */
  private saveToStorage(orders: Order[]) {
    const compacted = this.compactForStorage(orders);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(compacted));
    } catch {
      // Still too big — halve the list (oldest first) until it fits.
      let trimmed = compacted;
      while (trimmed.length > 5) {
        trimmed = trimmed.slice(0, Math.ceil(trimmed.length / 2));
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
          break;
        } catch {}
      }
    }
    // The in-memory copy keeps the full data so the live UI stays correct.
    this.ordersSubject.next(orders);
  }

  /** Drops bulky image arrays and shrinks big base64 photos to thumbnails. */
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

  /** Shrinks a base64 image to a small JPEG thumbnail for storage. */
  private makeThumb(dataUrl: string): string {
    try {
      const img = new Image();
      img.src = dataUrl;
      // Data-URL images decode synchronously in practice, so an immediate
      // canvas draw works; if not ready, return an empty marker.
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

  createOrder(order: Order) {
    const orders = this.getStoredOrders();
    orders.unshift(order);
    this.saveToStorage(orders);
  }

  // Backward compatibility alias for createOrder
  addOrder(order: Order) {
    this.createOrder(order);
  }

  updateOrderStatus(orderId: string, status: Order['status'] | string) {
    const orders = this.getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = status as any;
      this.saveToStorage(orders);
    }
  }

  assignRider(orderId: string, riderName: string, riderPhone: string) {
    const orders = this.getStoredOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.assignedRiderName = riderName;
      order.assignedRiderPhone = riderPhone;
      order.status = 'Out for Delivery';
      this.saveToStorage(orders);
    }
  }

  async submitOrderReview(orderId: string, rating: number, feedback: string) {
    const orders = this.getStoredOrders();
    const targetOrder = orders.find(o => o.id === orderId);

    if (targetOrder) {
      targetOrder.rating = rating;
      targetOrder.feedback = feedback;
      targetOrder.reviewedAt = new Date();
      this.saveToStorage(orders);

      // Automatically link review comments and star ratings to food menu items
      if (targetOrder.items && targetOrder.items.length > 0) {
        for (const item of targetOrder.items) {
          this.foodService.addReviewToFood(item.food.id, {
            id: Math.random().toString(36).substring(2, 9),
            foodId: item.food.id,
            customerName: targetOrder.customerName || 'Verified Customer',
            rating: rating,
            comment: feedback || 'Great food!',
            createdAt: new Date()
          });
        }
      }
    }
  }
}
