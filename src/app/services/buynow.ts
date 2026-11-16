import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem } from '../models/food.model';

/**
 * Holds a single "Order Now" item that goes straight to checkout,
 * completely independent of the shopping cart. The item persists across
 * page reloads (session storage via localStorage) so an in-progress
 * express checkout can never silently turn into a cart checkout.
 * Placing the order (or returning to the cart path) clears it without
 * touching the cart.
 */
@Injectable({
  providedIn: 'root'
})
export class BuyNowService {
  private readonly STORAGE_KEY = 'app_buynow_item';

  private itemSubject = new BehaviorSubject<CartItem | null>(this.readItem());
  public item$ = this.itemSubject.asObservable();

  setItem(item: CartItem): void {
    const copy: CartItem = { ...item };
    this.itemSubject.next(copy);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(copy));
    } catch {}
  }

  /** Adjusts the quantity of the pending buy-now item (min 1). */
  changeQuantity(delta: number): void {
    const current = this.itemSubject.value;
    if (!current) return;
    const qty = Math.max(1, (current.quantity || 1) + delta);
    this.setItem({ ...current, quantity: qty });
  }

  clear(): void {
    this.itemSubject.next(null);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {}
  }

  private readItem(): CartItem | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.food && parsed.quantity) {
          return parsed as CartItem;
        }
      }
    } catch {}
    return null;
  }

  get item(): CartItem | null {
    return this.itemSubject.value;
  }
}
