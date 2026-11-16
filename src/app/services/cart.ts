import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem, FoodItem } from '../models/food.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems = new BehaviorSubject<CartItem[]>(this.loadCart());
  public cart$ = this.cartItems.asObservable();

  private loadCart(): CartItem[] {
    try {
      const saved = localStorage.getItem('app_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private saveCart(items: CartItem[]): void {
    this.cartItems.next([...items]);
    try {
      localStorage.setItem('app_cart', JSON.stringify(items));
    } catch {}
  }

  getCart(): CartItem[] {
    return this.cartItems.value;
  }

  addToCart(
    food: FoodItem,
    selectedOption: string = 'Regular',
    quantity: number = 1,
    unitPrice?: number,
    note?: string
  ): void {
    const current = this.cartItems.value;
    const existingIndex = current.findIndex(
      item => item.food.id === food.id && item.selectedOption === selectedOption
    );

    if (existingIndex > -1) {
      current[existingIndex].quantity += quantity;
      this.saveCart([...current]);
    } else {
      this.saveCart([...current, { food, quantity, selectedOption, unitPrice: unitPrice ?? food.price, note, selected: true }]);
    }
  }

  // ==========================================
  // CHECKOUT SELECTION (per-item checkboxes)
  // ==========================================

  /** An item counts as checked unless explicitly marked unchecked. */
  isChecked(item: CartItem): boolean {
    return item.selected !== false;
  }

  setItemSelected(foodId: number, selectedOption: string | undefined, checked: boolean): void {
    const current = this.cartItems.value;
    const target = current.find(
      item => item.food.id === foodId && (!selectedOption || item.selectedOption === selectedOption)
    );
    if (target) {
      target.selected = checked;
      this.saveCart([...current]);
    }
  }

  setAllSelected(checked: boolean): void {
    const current = this.cartItems.value.map(item => ({ ...item, selected: checked }));
    this.cartItems.next(current);
    localStorage.setItem('app_cart', JSON.stringify(current));
  }

  getCheckedItems(): CartItem[] {
    return this.cartItems.value.filter(item => this.isChecked(item));
  }

  getCheckedTotal(): number {
    return this.getCheckedItems().reduce(
      (sum, item) => sum + this.getUnitPrice(item) * item.quantity,
      0
    );
  }

  /** Removes only the checked items — unchecked items stay in the cart. */
  removeChecked(): void {
    const remaining = this.cartItems.value.filter(item => !this.isChecked(item));
    this.cartItems.next(remaining);
    localStorage.setItem('app_cart', JSON.stringify(remaining));
  }

  increaseQuantity(foodId: number, selectedOption?: string): void {
    const current = this.cartItems.value;
    const target = current.find(
      item => item.food.id === foodId && (!selectedOption || item.selectedOption === selectedOption)
    );
    if (target) {
      target.quantity += 1;
      this.saveCart([...current]);
    }
  }

  decreaseQuantity(foodId: number, selectedOption?: string): void {
    const current = this.cartItems.value;
    const target = current.find(
      item => item.food.id === foodId && (!selectedOption || item.selectedOption === selectedOption)
    );
    if (target) {
      if (target.quantity > 1) {
        target.quantity -= 1;
        this.saveCart([...current]);
      } else {
        this.removeFromCart(foodId, selectedOption);
      }
    }
  }

  removeFromCart(foodId: number, selectedOption?: string): void {
    const updated = this.cartItems.value.filter(
      item => !(item.food.id === foodId && (!selectedOption || item.selectedOption === selectedOption))
    );
    this.saveCart(updated);
  }

  /** Unit price of an item, honoring the chosen variation's price. */
  getUnitPrice(item: CartItem): number {
    return item.unitPrice ?? item.food.price;
  }

  getTotal(): number {
    return this.cartItems.value.reduce(
      (sum, item) => sum + this.getUnitPrice(item) * item.quantity,
      0
    );
  }

  clearCart(): void {
    this.saveCart([]);
  }
}