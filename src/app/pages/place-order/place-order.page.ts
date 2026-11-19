import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardSubtitle, 
  IonCardContent, 
  IonSegment, 
  IonSegmentButton, 
  IonItem, 
  IonInput, 
  IonTextarea, 
  IonButton, 
  IonRadioGroup, 
  IonRadio, 
  IonIcon, 
  IonLabel,
  IonModal,
  AlertController, 
  LoadingController,
  ToastController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  bicycle, 
  restaurant, 
  navigate, 
  documentTextOutline, 
  trashOutline, 
  checkmarkCircleOutline,
  bagHandleOutline,
  add,
  remove,
  walletOutline,
  locationOutline,
  navigateOutline,
  ticketOutline,
  closeCircleOutline,
  pricetagOutline,
  chevronForwardOutline,
  copyOutline,
  closeOutline,
  downloadOutline,
  qrCodeOutline
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Geolocation } from '@capacitor/geolocation';
import { CartService } from '../../services/cart';
import { FoodService } from '../../services/food';
import { OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';
import { WalletService } from '../../services/wallet';
import { WalletQrService } from '../../services/wallet-qr';
import { BuyNowService } from '../../services/buynow';
import { TopUpService } from '../../services/topup';
import { CloudSyncService } from '../../services/cloud-sync';
import { CartItem, Order, Voucher } from '../../models/food.model';
import { VoucherService } from '../../services/voucher';
import { MembershipService, MembershipInfo } from '../../services/membership';

@Component({
  selector: 'app-place-order',
  templateUrl: './place-order.page.html',
  styleUrls: ['./place-order.page.scss'],
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
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonCardContent, 
    IonSegment, 
    IonSegmentButton, 
    IonItem, 
    IonInput, 
    IonTextarea, 
    IonButton, 
    IonRadioGroup, 
    IonRadio, 
    IonIcon, 
    IonLabel,
    IonModal
  ]
})
export class PlaceOrderPage implements OnInit, OnDestroy {
  private cartService = inject(CartService);
  private foodService = inject(FoodService);
  private orderService = inject(OrderService);
  private voucherService = inject(VoucherService);
  private membershipService = inject(MembershipService);
  private cloudSync = inject(CloudSyncService);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private walletService = inject(WalletService);
  private walletQrService = inject(WalletQrService);
  private buyNow = inject(BuyNowService);
  public topupService = inject(TopUpService);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  cart: CartItem[] = [];
  isBuyNow: boolean = false;
  checkoutItems: CartItem[] = [];
  orderType: 'delivery' | 'dine-in' | 'pickup' = 'delivery';
  paymentMethod: 'cod' | 'online' | 'shopeepay' = 'cod';
  
  deliveryAddress: string = '';
  userCoords?: { latitude: number; longitude: number };
  tableNumber: string = '';
  pickupTime: string = 'In 20-30 minutes';
  orderNotes: string = '';
  walletBalance: number = 0;

  // QR Cashier Modal State
  isQrCashierOpen: boolean = false;
  cashierOrderId: string = '';
  cashierTransactionId: string = '';
  cashierQrId: string = '';
  cashierOrderTime: string = '';
  cashierDescription: string = '';
  cashierQrImageUrl: string = '';
  cashierSecondsLeft: number = 15 * 60;
  private cashierTimerHandle: any = null;
  gcashReferenceNumber: string = '';

  // Distance & Shipping Rate (₱15 per 1 km, tracked via GPS only)
  readonly ratePerKm: number = 15;
  distanceInKm: number = 0;

  // Applied Voucher
  appliedVoucher: Voucher | null = null;

  // Membership Info (Bronze 10%, Silver 20%, Gold 30%)
  membershipInfo: MembershipInfo | null = this.membershipService.getCurrentMembership();

  constructor() {
    addIcons({ 
      bicycle, 
      restaurant, 
      navigate, 
      documentTextOutline, 
      trashOutline, 
      checkmarkCircleOutline,
      bagHandleOutline,
      add,
      remove,
      walletOutline,
      locationOutline,
      navigateOutline,
      ticketOutline,
      closeCircleOutline,
      pricetagOutline,
      chevronForwardOutline,
      copyOutline,
      closeOutline,
      downloadOutline,
      qrCodeOutline
    });
  }

  ngOnInit() {
    this.cartService.cart$.subscribe(items => {
      this.cart = items;
      if (!this.isBuyNow) {
        this.checkoutItems = items.filter(item => this.cartService.isChecked(item));
      }
      this.cdr.detectChanges();
    });

    this.buyNow.item$.subscribe(item => {
      if (item) {
        this.isBuyNow = true;
        this.checkoutItems = [item];
      } else if (this.isBuyNow) {
        this.isBuyNow = false;
        this.checkoutItems = this.cart.filter(item => this.cartService.isChecked(item));
      }
      this.cdr.detectChanges();
    });

    this.walletService.balance$.subscribe(bal => {
      this.walletBalance = bal;
      this.cdr.detectChanges();
    });

    this.walletQrService.settings$.subscribe(() => {
      this.cdr.detectChanges();
    });

    this.membershipService.membership$.subscribe(info => {
      this.membershipInfo = info;
      this.cdr.detectChanges();
    });

    this.foodService.foods$.subscribe(() => this.cdr.detectChanges());
    this.voucherService.vouchers$.subscribe(vouchers => {
      if (this.appliedVoucher) {
        const latest = vouchers.find(v => v.id === this.appliedVoucher?.id);
        this.appliedVoucher = latest || null;
      }
      this.cdr.detectChanges();
    });
    this.cloudSync.changes$.subscribe(({ key }) => {
      if (key === 'store_location' || key === 'admin_gcash_info' || key === 'app_wallet_qr') {
        this.recalculateDistanceFromStore();
        this.cdr.detectChanges();
      }
    });

    this.loadVoucher();
    this.membershipInfo = this.membershipService.refresh();
  }

  ngOnDestroy() {
    this.stopCashierTimer();
  }

  ionViewWillEnter() {
    this.loadVoucher();
    this.membershipInfo = this.membershipService.refresh();
    this.cdr.detectChanges();
  }

  onOrderTypeChange(event: any) {
    const val = event?.detail?.value;
    if (val === 'delivery' || val === 'dine-in' || val === 'pickup') {
      this.orderType = val;
      this.cdr.detectChanges();
    }
  }

  setPaymentMethod(method: 'cod' | 'online' | 'shopeepay') {
    this.paymentMethod = method;
    this.cdr.detectChanges();
  }

  onPaymentMethodChange(event: any) {
    const val = event?.detail?.value;
    if (val === 'cod' || val === 'online' || val === 'shopeepay') {
      this.paymentMethod = val;
      this.cdr.detectChanges();
    }
  }

  loadVoucher() {
    try {
      const v = localStorage.getItem('applied_voucher');
      this.appliedVoucher = v ? JSON.parse(v) : null;
    } catch {
      this.appliedVoucher = null;
    }
    this.cdr.detectChanges();
  }

  get activeAppliedVoucher(): Voucher | null {
    if (!this.appliedVoucher) return null;
    return this.voucherService.isVoucherApplicable(
      this.appliedVoucher,
      this.subtotal,
      this.orderType
    )
      ? this.appliedVoucher
      : null;
  }

  selectVoucherFromMe() {
    this.router.navigate(['/me'], {
      queryParams: {
        openVouchers: 'true',
        returnUrl: '/place-order',
        subtotal: this.subtotal,
        orderType: this.orderType
      }
    });
  }

  removeVoucher() {
    this.appliedVoucher = null;
    localStorage.removeItem('applied_voucher');
    this.showToast('Voucher removed', 'dark');
  }

  private recalculateDistanceFromStore() {
    if (!this.userCoords) return;
    const store = this.getStoreLocation();
    const calculatedKm = this.calculateDistance(
      store.latitude,
      store.longitude,
      this.userCoords.latitude,
      this.userCoords.longitude
    );
    this.distanceInKm = Math.max(1.0, Math.round(calculatedKm * 10) / 10);
  }

  getStoreLocation(): { latitude: number; longitude: number; address: string } {
    try {
      const saved = localStorage.getItem('store_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) {
          return parsed;
        }
      }
    } catch {}
    return { latitude: 15.36356, longitude: 121.06583, address: 'Store Main Kitchen' };
  }

  /** Dynamically reads GCash QR & details saved in Admin (no hardcoded personal info) */
  get adminGcash(): { accountName: string; number: string; qrImage?: string } {
    const walletQr = this.walletQrService.getSettings();
    if (walletQr.image || walletQr.accountNumber || walletQr.accountName) {
      return {
        accountName: walletQr.accountName || walletQr.walletLabel || 'GCash',
        number: walletQr.accountNumber || '',
        qrImage: walletQr.image || ''
      };
    }

    try {
      const saved = localStorage.getItem('admin_gcash_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.number || parsed.qrImage || parsed.accountName) {
          return {
            accountName: parsed.accountName || 'GCash',
            number: parsed.number || '',
            qrImage: parsed.qrImage || ''
          };
        }
      }
    } catch {}

    return {
      accountName: 'GCash',
      number: '',
      qrImage: ''
    };
  }

  // ============================================
  // VOUCHER & PRICING CALCULATIONS
  // ============================================

  get isFreeShippingVoucher(): boolean {
    return this.voucherService.isShippingVoucher(this.activeAppliedVoucher);
  }

  get subtotal(): number {
    if (this.isBuyNow && this.checkoutItems.length > 0) {
      return this.lineTotal(this.checkoutItems[0]);
    }
    return this.cartService.getCheckedTotal();
  }

  get rawShippingFee(): number {
    if (this.orderType !== 'delivery' || !this.userCoords) {
      return 0;
    }
    return Math.max(15, Math.round(this.distanceInKm * this.ratePerKm));
  }

  get discountAmount(): number {
    const voucher = this.activeAppliedVoucher;
    if (!voucher) return 0;

    if (this.isFreeShippingVoucher) {
      return this.orderType === 'delivery' ? this.rawShippingFee : 0;
    }

    const minSpend = Number(voucher.minSpend) || 0;
    if (this.subtotal < minSpend) return 0;

    if (voucher.discountType === 'percent') {
      const pct = Number(voucher.discountValue) || 0;
      return Math.min(this.subtotal, (this.subtotal * pct) / 100);
    }
    if (voucher.discountType === 'fixed') {
      return Math.min(this.subtotal, Number(voucher.discountValue) || 0);
    }

    const match = (voucher.headline || '').match(/\d+/);
    const flatOff = match ? parseInt(match[0], 10) : 0;
    return Math.min(this.subtotal, flatOff);
  }

  get finalShippingFee(): number {
    if (this.orderType !== 'delivery') return 0;
    if (this.isFreeShippingVoucher) {
      return 0;
    }
    return this.rawShippingFee;
  }

  get membershipDiscount(): number {
    const pct = Number(this.membershipInfo?.discountPercent) || 0;
    if (pct <= 0) return 0;
    return Math.round(((this.subtotal * pct) / 100) * 100) / 100;
  }

  get totalAmount(): number {
    const nonShippingDiscount = !this.isFreeShippingVoucher ? this.discountAmount : 0;
    const total = this.subtotal + this.finalShippingFee - nonShippingDiscount - this.membershipDiscount;
    return Math.max(0, total);
  }

  unitPriceOf(item: CartItem): number {
    return this.cartService.getUnitPrice(item);
  }

  variantLabel(option?: string): string {
    if (!option) return '';
    return option
      .replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  lineTotal(item: CartItem): number {
    return this.unitPriceOf(item) * item.quantity;
  }

  get isBalanceSufficient(): boolean {
    return this.walletBalance >= this.totalAmount;
  }

  // ============================================
  // QR CASHIER MODAL ACTIONS (ADMIN GCASH QR)
  // ============================================

  get formattedCashierTimer(): string {
    const mins = Math.floor(this.cashierSecondsLeft / 60);
    const secs = this.cashierSecondsLeft % 60;
    return `${mins}min ${secs < 10 ? '0' + secs : secs}s`;
  }

  private async openQrCashierModal(orderId: string) {
    const gcash = this.adminGcash;

    if (!gcash.qrImage) {
      const alert = await this.alertCtrl.create({
        header: 'GCash QR Unavailable',
        message: 'No GCash QR code has been uploaded yet. Please upload one in Admin → Wallet QR settings.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    this.cashierOrderId = orderId;
    this.cashierTransactionId = `TXN${Date.now().toString().slice(-10)}`;
    this.cashierQrId = '';
    this.cashierOrderTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.cashierDescription = this.checkoutItems.map(i => `${i.quantity}x ${i.food.name}`).join(', ');
    this.gcashReferenceNumber = '';
    this.cashierQrImageUrl = gcash.qrImage;

    this.cashierSecondsLeft = 15 * 60;
    this.stopCashierTimer();
    this.cashierTimerHandle = setInterval(() => {
      if (this.cashierSecondsLeft > 0) {
        this.cashierSecondsLeft--;
      } else {
        this.stopCashierTimer();
      }
      this.cdr.detectChanges();
    }, 1000);

    this.isQrCashierOpen = true;
    this.cdr.detectChanges();
  }

  closeQrCashier() {
    this.isQrCashierOpen = false;
    this.stopCashierTimer();
  }

  private stopCashierTimer() {
    if (this.cashierTimerHandle) {
      clearInterval(this.cashierTimerHandle);
      this.cashierTimerHandle = null;
    }
  }

  async copyAdminGcashNumber() {
    const cleanNum = this.adminGcash.number.replace(/-/g, '');
    if (!cleanNum) return;
    try {
      await navigator.clipboard.writeText(cleanNum);
      this.showToast(`GCash number (${cleanNum}) copied!`, 'success');
    } catch {
      this.showToast(`GCash Number: ${cleanNum}`, 'dark');
    }
  }

  async openInGcash() {
    const cleanNum = this.adminGcash.number.replace(/-/g, '');
    if (cleanNum) {
      try {
        await navigator.clipboard.writeText(cleanNum);
      } catch {}
    }

    if (Capacitor.isNativePlatform()) {
      this.showToast(
        cleanNum
          ? `Number ${cleanNum} copied! Opening GCash — pay ₱${this.totalAmount.toFixed(2)}.`
          : `Opening GCash — scan the QR and pay ₱${this.totalAmount.toFixed(2)}.`,
        'success'
      );
      try {
        const { value: hasPackage } = await AppLauncher.canOpenUrl({
          url: 'com.globe.gcash.android',
        });

        if (hasPackage) {
          await AppLauncher.openUrl({ url: 'com.globe.gcash.android' });
          return;
        }

        const { value: hasScheme } = await AppLauncher.canOpenUrl({
          url: 'gcash://',
        });

        if (hasScheme) {
          await AppLauncher.openUrl({ url: 'gcash://' });
          return;
        }

        if (Capacitor.getPlatform() === 'android') {
          await AppLauncher.openUrl({
            url: 'https://play.google.com/store/apps/details?id=com.globe.gcash.android',
          });
          return;
        }
      } catch (error) {
        console.error('Could not launch GCash:', error);
      }
    }

    const ua = navigator.userAgent || '';
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);

    if (isAndroid) {
      this.showToast(`Opening GCash — pay exact ₱${this.totalAmount.toFixed(2)}.`, 'success');
      window.location.href = 'intent://#Intent;scheme=gcash;package=com.globe.gcash.android;end';
      return;
    }

    if (isIOS) {
      this.showToast(`Opening GCash — pay exact ₱${this.totalAmount.toFixed(2)}.`, 'success');
      window.location.href = 'gcash://';
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Pay via GCash App',
      subHeader: cleanNum ? `Number Copied: ${cleanNum}` : this.adminGcash.accountName,
      message: `Open GCash on your phone → tap QR → Scan this QR (or tap Save QR Code and Upload QR from Gallery) for ₱${this.totalAmount.toFixed(2)}.`,
      buttons: ['OK']
    });
    await alert.present();
  }

  async saveQrCode() {
    if (!this.cashierQrImageUrl) return;
    try {
      if (this.cashierQrImageUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = this.cashierQrImageUrl;
        a.download = `gcash-qr-${this.cashierOrderId}.png`;
        a.click();
      } else {
        const res = await fetch(this.cashierQrImageUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `gcash-qr-${this.cashierOrderId}.png`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
      this.showToast('QR Code saved! Open GCash → QR → Upload QR from Gallery.', 'success');
    } catch {
      window.open(this.cashierQrImageUrl, '_blank');
    }
  }

  async confirmQrPaymentAndPlaceOrder() {
    const cleanRef = this.gcashReferenceNumber.replace(/\s+/g, '').trim();
    if (cleanRef.length < 6) {
      this.showToast('Please enter your GCash / Bank Reference Number (at least 6 characters).', 'warning');
      return;
    }

    const orderId = this.cashierOrderId || Math.floor(100000 + Math.random() * 900000).toString();
    this.closeQrCashier();
    await this.finalizeOrderRecord(orderId, cleanRef);
  }

  private generateGcashRefSlip(refNo: string, amount: number): string {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 520;
      canvas.height = 310;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, 72);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText('GCASH QR • PAYMENT DETAILS', 24, 44);

      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(24, 92, 210, 30);
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.fillText('PAYMENT RECORD', 34, 112);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(`₱${amount.toFixed(2)}`, 24, 160);

      ctx.fillStyle = '#334155';
      ctx.font = '15px Arial, sans-serif';
      ctx.fillText(`Reference No: ${refNo}`, 24, 198);
      ctx.fillText(`Transaction ID: ${this.cashierTransactionId}`, 24, 226);
      ctx.fillText(`To: ${this.adminGcash.number || this.adminGcash.accountName}`, 24, 254);
      ctx.fillText(`Submitted: ${new Date().toLocaleString()}`, 24, 282);

      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  // ============================================
  // CART & LOCATION ACTIONS
  // ============================================

  increaseQty(foodId: any, selectedOption?: string) {
    const liveFood = this.foodService.getFoods().find(f => String(f.id) === String(foodId));
    if (liveFood) {
      const maxStock =
        liveFood.available === false
          ? 0
          : (typeof liveFood.stock === 'number' ? liveFood.stock : 20);
      const totalForFood = this.checkoutItems
        .filter(i => String(i.food.id) === String(foodId))
        .reduce((sum, i) => sum + i.quantity, 0);

      if (totalForFood >= maxStock) {
        this.showToast(`Only ${maxStock} order(s) available for "${liveFood.name}".`, 'warning');
        return;
      }
    }

    if (this.isBuyNow) {
      this.buyNow.changeQuantity(1);
      return;
    }
    (this.cartService as any).increaseQuantity(foodId, selectedOption);
  }

  decreaseQty(foodId: any, selectedOption?: string) {
    if (this.isBuyNow) {
      this.buyNow.changeQuantity(-1);
      return;
    }
    (this.cartService as any).decreaseQuantity(foodId, selectedOption);
  }

  removeItem(foodId: any, selectedOption?: string) {
    if (this.isBuyNow) {
      this.buyNow.clear();
      this.isBuyNow = false;
      this.checkoutItems = this.cart;
      this.router.navigate(['/menu']);
      return;
    }
    (this.cartService as any).removeFromCart(foodId, selectedOption);
  }

  promptTopUp() {
    this.topupService.present();
  }

  async detectCurrentLocation() {
    const loading = await this.loadingCtrl.create({
      message: 'Detecting GPS and calculating distance from store...',
    });
    await loading.present();

    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      this.userCoords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      };
      this.deliveryAddress = `Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`;
      this.recalculateDistanceFromStore();
      this.cdr.detectChanges();

      const feeText = this.isFreeShippingVoucher
        ? 'FREE shipping applied'
        : `₱${this.rawShippingFee} shipping fee`;
      this.showToast(`Location detected: ${this.distanceInKm} km away (${feeText})`, 'success');
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: 'Location Permission',
        message: 'Could not access GPS. Please enable location permissions and try again.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      await loading.dismiss();
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async submitOrder() {
    if (this.checkoutItems.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'There are no items to checkout.',
        duration: 1800,
        color: 'warning',
        position: 'top'
      });
      return toast.present();
    }

    const qtyByFood = new Map<string, { name: string; qty: number }>();
    for (const item of this.checkoutItems) {
      const id = item.food?.id;
      if (id === undefined || id === null) continue;
      const key = String(id);
      const prev = qtyByFood.get(key);
      qtyByFood.set(key, {
        name: item.food.name,
        qty: (prev ? prev.qty : 0) + (item.quantity || 1)
      });
    }

    const allFoods = this.foodService.getFoods();
    for (const [foodKey, entry] of qtyByFood.entries()) {
      const liveFood = allFoods.find(f => String(f.id) === foodKey);
      if (liveFood) {
        const availableStock = liveFood.available === false
          ? 0
          : (typeof liveFood.stock === 'number' ? liveFood.stock : 20);

        if (availableStock <= 0) {
          const alert = await this.alertCtrl.create({
            header: 'Item Sold Out',
            message: `Sorry, "${entry.name}" is already out of stock.`,
            buttons: ['OK']
          });
          return alert.present();
        }

        if (entry.qty > availableStock) {
          const alert = await this.alertCtrl.create({
            header: 'Insufficient Orders Available',
            message: `Sorry, "${entry.name}" only has ${availableStock} order(s) available.`,
            buttons: ['OK']
          });
          return alert.present();
        }
      }
    }

    if (this.orderType === 'delivery' && !this.userCoords) {
      const alert = await this.alertCtrl.create({
        header: 'GPS Location Required',
        message: 'Please tap "Use Current GPS Location" so we can track your distance from the store.',
        buttons: ['OK']
      });
      return alert.present();
    }

    if (this.orderType === 'delivery' && !this.deliveryAddress.trim()) {
      const alert = await this.alertCtrl.create({
        header: 'Missing Location',
        message: 'Please provide or detect your location so the rider can find you.',
        buttons: ['OK']
      });
      return alert.present();
    }

    if (this.orderType === 'dine-in' && !this.tableNumber.trim()) {
      const alert = await this.alertCtrl.create({
        header: 'Missing Table Number',
        message: 'Please specify your table number so the staff can serve you.',
        buttons: ['OK']
      });
      return alert.present();
    }

    if (this.paymentMethod === 'shopeepay' && !this.isBalanceSufficient) {
      const alert = await this.alertCtrl.create({
        header: 'Insufficient Wallet Balance',
        message: `Your balance is ₱${this.walletBalance.toFixed(2)}, but order total is ₱${this.totalAmount.toFixed(2)}. Please top up or choose another payment method.`,
        buttons: [
          { text: 'Choose Other Method', role: 'cancel' },
          {
            text: 'Top Up Now',
            handler: () => {
              this.promptTopUp();
            }
          }
        ]
      });
      return alert.present();
    }

    const orderId = Math.floor(100000 + Math.random() * 900000).toString();

    if (this.paymentMethod === 'online') {
      await this.openQrCashierModal(orderId);
      return;
    }

    await this.finalizeOrderRecord(orderId);
  }

  private async finalizeOrderRecord(orderId: string, gcashRef?: string) {
    const currentUser = this.authService.getCurrentUser();
    const refNote = gcashRef ? `[QR Payment Ref: ${gcashRef} | TXN: ${this.cashierTransactionId}]` : '';
    const combinedNotes = [this.orderNotes.trim(), refNote].filter(Boolean).join(' • ');

    const newOrder: Order = {
      id: orderId,
      createdAt: new Date(),
      customerPhone: currentUser?.phone || 'Customer',
      customerName: currentUser?.fullName || 'Customer',
      items: [...this.checkoutItems],
      orderType: this.orderType,
      deliveryAddress: this.orderType === 'delivery' ? this.deliveryAddress : undefined,
      tableNumber: this.orderType === 'dine-in' ? this.tableNumber : undefined,
      pickupTime: this.orderType === 'pickup' ? this.pickupTime : undefined,
      latitude: this.userCoords?.latitude,
      longitude: this.userCoords?.longitude,
      distance: this.orderType === 'delivery' ? this.distanceInKm : 0,
      subtotal: this.subtotal,
      shippingFee: this.finalShippingFee,
      discountAmount: this.discountAmount + this.membershipDiscount,
      totalAmount: this.totalAmount,
      paymentMethod: this.paymentMethod,
      paymentProof: this.paymentMethod === 'online' && gcashRef
        ? this.generateGcashRefSlip(gcashRef, this.totalAmount)
        : undefined,
      notes: combinedNotes || undefined,
      status: 'Pending'
    };

    try {
      await this.orderService.addOrder(newOrder);
      this.membershipInfo = this.membershipService.refresh();
    } catch (e) {
      const toast = await this.toastCtrl.create({
        message: 'Could not save your order. Please try again or contact the store.',
        duration: 4000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
      return;
    }

    const usedVoucher = this.activeAppliedVoucher;
    if (usedVoucher) {
      const user = this.authService.getCurrentUser();
      const customerKey =
        (user && (user.phone || user.fullName)) || 'guest';
      this.voucherService.markUsed(usedVoucher.id, customerKey);
      this.appliedVoucher = null;
      localStorage.removeItem('applied_voucher');
    }

    if (this.paymentMethod === 'shopeepay') {
      this.walletService.deduct(this.totalAmount);
    }

    let paymentText = '';
    if (this.paymentMethod === 'shopeepay') {
      paymentText = 'Wallet (Paid Instantly)';
    } else if (this.paymentMethod === 'cod') {
      paymentText = this.orderType === 'delivery' ? 'Cash on Delivery (COD)' : this.orderType === 'dine-in' ? 'Cash (Counter/Table)' : 'Cash upon Pick-Up';
    } else {
      paymentText = `GCash QR (Ref: ${gcashRef})`;
    }

    let alertMessage = '';
    if (this.orderType === 'delivery') {
      const shippingSummary = this.finalShippingFee === 0 ? 'FREE (₱0.00)' : `₱${this.finalShippingFee.toFixed(2)}`;
      alertMessage = `Your delivery order (₱${this.totalAmount.toFixed(2)}) via ${paymentText} is placed! Estimated distance: ${this.distanceInKm} km (Shipping fee: ${shippingSummary}).`;
    } else if (this.orderType === 'dine-in') {
      alertMessage = `Your Dine-In order for Table ${this.tableNumber} (₱${this.totalAmount.toFixed(2)}) via ${paymentText} is placed!`;
    } else {
      alertMessage = `Your Pick-Up order (₱${this.totalAmount.toFixed(2)}) via ${paymentText} is placed! Estimated ready: ${this.pickupTime}.`;
    }

    const alert = await this.alertCtrl.create({
      header: 'Order Placed!',
      message: alertMessage,
      buttons: [{
        text: 'Back to Menu',
        handler: () => {
          if (this.isBuyNow) {
            this.buyNow.clear();
          } else {
            this.cartService.removeChecked();
          }
          this.router.navigate(['/menu']);
        }
      }]
    });
    await alert.present();
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'dark' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}