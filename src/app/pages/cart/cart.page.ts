import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonButton,
  IonIcon,
  ToastController,
  AlertController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cartOutline,
  trashOutline,
  walletOutline,
  arrowForwardOutline,
  add,
  remove,
  checkmarkCircle
} from 'ionicons/icons';
import { CartService } from '../../services/cart';
import { WalletService } from '../../services/wallet';
import { ThemeService } from '../../services/theme.service';
import { CartItem } from '../../models/food.model';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonBackButton,
    IonButtons,
    IonButton,
    IonIcon
  ]
})
export class CartPage implements OnInit {
  private cartService = inject(CartService);
  private walletService = inject(WalletService, { optional: true });
  private themeService = inject(ThemeService, { optional: true });
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);

  cartItems: CartItem[] = [];
  walletBalance: number = 0;
  isDarkMode: boolean = false;

  constructor() {
    addIcons({
      cartOutline,
      trashOutline,
      walletOutline,
      arrowForwardOutline,
      add,
      remove,
      checkmarkCircle
    });
  }

  ngOnInit() {
    // 1. Subscribe to Cart Items
    if (this.cartService?.cart$) {
      this.cartService.cart$.subscribe((items) => {
        this.cartItems = items || [];
      });
    } else {
      this.loadCartFromStorage();
    }

    // 2. Subscribe to Wallet Balance
    const ws: any = this.walletService;
    if (ws) {
      if (ws.balance$?.subscribe) {
        ws.balance$.subscribe((bal: number) => (this.walletBalance = bal));
      } else if (typeof ws.getBalance === 'function') {
        this.walletBalance = ws.getBalance();
      }
    }

    // 3. Theme mode
    if (this.themeService?.isDarkMode$) {
      this.themeService.isDarkMode$.subscribe((dark) => (this.isDarkMode = dark));
    }
  }

  ionViewWillEnter() {
    this.loadCartFromStorage();
  }

  loadCartFromStorage() {
    try {
      const stored = localStorage.getItem('app_cart');
      if (stored) {
        this.cartItems = JSON.parse(stored);
      }
    } catch {
      this.cartItems = [];
    }
  }

  // ============================================
  // GETTERS & COMPUTED PROPERTIES
  // ============================================

  get cartCount(): number {
    return this.cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  get allSelected(): boolean {
    if (this.cartItems.length === 0) return false;
    if (typeof (this.cartService as any)?.isAllSelected === 'function') {
      return (this.cartService as any).isAllSelected();
    }
    return this.cartItems.every((item) => item.selected !== false);
  }

  get checkedCount(): number {
    if (typeof (this.cartService as any)?.getCheckedCount === 'function') {
      return (this.cartService as any).getCheckedCount();
    }
    return this.cartItems.filter((item) => item.selected !== false).length;
  }

  get checkedQuantity(): number {
    if (typeof (this.cartService as any)?.getCheckedQuantity === 'function') {
      return (this.cartService as any).getCheckedQuantity();
    }
    return this.cartItems
      .filter((item) => item.selected !== false)
      .reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  get checkedTotal(): number {
    if (typeof (this.cartService as any)?.getCheckedTotal === 'function') {
      return (this.cartService as any).getCheckedTotal();
    }
    return this.cartItems
      .filter((item) => item.selected !== false)
      .reduce((sum, item) => sum + this.lineTotal(item), 0);
  }

  // ============================================
  // ITEM HELPERS & PRICING
  // ============================================

  unitPriceOf(item: CartItem): number {
    if (typeof (this.cartService as any)?.getUnitPrice === 'function') {
      return (this.cartService as any).getUnitPrice(item);
    }
    return item.unitPrice ?? item.food?.price ?? 0;
  }

  lineTotal(item: CartItem): number {
    return this.unitPriceOf(item) * (item.quantity || 1);
  }

  variantLabel(option?: string): string {
    if (!option) return '';
    return option
      .replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // ============================================
  // SELECTION & CHECKBOXES
  // ============================================

  isChecked(item: CartItem): boolean {
    if (typeof (this.cartService as any)?.isChecked === 'function') {
      return (this.cartService as any).isChecked(item);
    }
    return item.selected !== false;
  }

  toggleItem(item: CartItem, event: any) {
    const checked = event?.target?.checked;
    if (typeof (this.cartService as any)?.toggleCheck === 'function') {
      (this.cartService as any).toggleCheck(item, checked);
    } else {
      item.selected = checked;
      this.syncCartStorage();
    }
  }

  toggleSelectAll(event: any) {
    const checked = event?.target?.checked;
    if (typeof (this.cartService as any)?.toggleSelectAll === 'function') {
      (this.cartService as any).toggleSelectAll(checked);
    } else {
      this.cartItems.forEach((item) => (item.selected = checked));
      this.syncCartStorage();
    }
  }

  // ============================================
  // QUANTITY & REMOVAL (FIXED: accepts any ID)
  // ============================================

  increaseQty(foodId: any, selectedOption?: string) {
    if (typeof (this.cartService as any)?.increaseQuantity === 'function') {
      (this.cartService as any).increaseQuantity(foodId, selectedOption);
    } else {
      const idx = this.cartItems.findIndex(
        (i) => i.food.id === foodId && i.selectedOption === selectedOption
      );
      if (idx > -1) {
        this.cartItems[idx].quantity = (this.cartItems[idx].quantity || 1) + 1;
        this.syncCartStorage();
      }
    }
  }

  decreaseQty(foodId: any, selectedOption?: string) {
    if (typeof (this.cartService as any)?.decreaseQuantity === 'function') {
      (this.cartService as any).decreaseQuantity(foodId, selectedOption);
    } else {
      const idx = this.cartItems.findIndex(
        (i) => i.food.id === foodId && i.selectedOption === selectedOption
      );
      if (idx > -1) {
        if (this.cartItems[idx].quantity > 1) {
          this.cartItems[idx].quantity--;
          this.syncCartStorage();
        } else {
          this.removeItem(foodId, selectedOption);
        }
      }
    }
  }

  async removeItem(foodId: any, selectedOption?: string) {
    if (typeof (this.cartService as any)?.removeFromCart === 'function') {
      (this.cartService as any).removeFromCart(foodId, selectedOption);
    } else {
      this.cartItems = this.cartItems.filter(
        (i) => !(i.food.id === foodId && i.selectedOption === selectedOption)
      );
      this.syncCartStorage();
    }
    this.presentToast('Item removed from cart.');
  }

  private syncCartStorage() {
    try {
      localStorage.setItem('app_cart', JSON.stringify(this.cartItems));
    } catch {}
  }

  // ============================================
  // NAVIGATION
  // ============================================

  goToMenu() {
    this.router.navigate(['/menu']);
  }

  proceedToCheckout() {
    if (this.checkedCount === 0) {
      this.presentToast('Please check at least 1 item to proceed.', 'warning');
      return;
    }
    this.router.navigate(['/place-order']);
  }

  private async presentToast(message: string, color: 'success' | 'warning' | 'danger' | 'dark' = 'dark') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1800,
      color,
      position: 'top'
    });
    await toast.present();
  }
}