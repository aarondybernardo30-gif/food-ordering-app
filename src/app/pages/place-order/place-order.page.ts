import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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
import { OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';
import { WalletService } from '../../services/wallet';
import { BuyNowService } from '../../services/buynow';
import { TopUpService } from '../../services/topup';
import { CartItem, Order } from '../../models/food.model';
import { VoucherItem } from '../me/me.page';

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
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private walletService = inject(WalletService);
  private buyNow = inject(BuyNowService);
  public topupService = inject(TopUpService);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  // Replace with your deployed Xendit Node backend URL
  private readonly XENDIT_BACKEND_URL = 'https://YOUR-BACKEND-URL.com';

  cart: CartItem[] = [];
  isBuyNow: boolean = false;
  checkoutItems: CartItem[] = [];
  orderType: 'delivery' | 'dine-in' | 'pickup' = 'delivery';
  paymentMethod: 'cod' | 'online' | 'shopeepay' = 'shopeepay';
  
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
  appliedVoucher: VoucherItem | null = null;

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
    });

    this.buyNow.item$.subscribe(item => {
      if (item) {
        this.isBuyNow = true;
        this.checkoutItems = [item];
      } else if (this.isBuyNow) {
        this.isBuyNow = false;
        this.checkoutItems = this.cart.filter(item => this.cartService.isChecked(item));
      }
    });

    this.walletService.balance$.subscribe(bal => (this.walletBalance = bal));
    this.loadVoucher();
  }

  ngOnDestroy() {
    this.stopCashierTimer();
  }

  ionViewWillEnter() {
    this.loadVoucher();
  }

  loadVoucher() {
    try {
      const v = localStorage.getItem('applied_voucher');
      this.appliedVoucher = v ? JSON.parse(v) : null;
    } catch {
      this.appliedVoucher = null;
    }
  }

  selectVoucherFromMe() {
    this.router.navigate(['/me'], {
      queryParams: {
        openVouchers: 'true',
        returnUrl: this.router.url
      }
    });
  }

  removeVoucher() {
    this.appliedVoucher = null;
    localStorage.removeItem('applied_voucher');
    this.showToast('Voucher removed', 'dark');
  }

  /** Gets the active store GPS location saved by the Admin */
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

  /** Gets the Admin GCash details saved in localStorage (or uses store default) */
  get adminGcash(): { accountName: string; number: string; qrImage?: string } {
    try {
      const saved = localStorage.getItem('admin_gcash_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.number || parsed.qrImage) {
          return {
            accountName: parsed.accountName || 'Food Ordering Store',
            number: parsed.number || '0912-345-6789',
            qrImage: parsed.qrImage || ''
          };
        }
      }
    } catch {}
    return {
      accountName: 'Food Ordering Store',
      number: '0912-345-6789',
      qrImage: ''
    };
  }

  // ============================================
  // VOUCHER & PRICING CALCULATIONS
  // ============================================

  get isFreeShippingVoucher(): boolean {
    if (!this.appliedVoucher) return false;
    const category = (this.appliedVoucher.category || '').toLowerCase();
    const code = (this.appliedVoucher.code || '').toUpperCase();
    const headline = (this.appliedVoucher.headline || '').toUpperCase();
    const title = (this.appliedVoucher.title || '').toUpperCase();

    return (
      category === 'shipping' ||
      category === 'freeship' ||
      category === 'free-shipping' ||
      category === 'delivery' ||
      code.includes('FREESHIP') ||
      code.includes('SHIP') ||
      headline.includes('FREE SHIPPING') ||
      title.includes('FREE DELIVERY')
    );
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
    if (!this.appliedVoucher) return 0;

    if (this.isFreeShippingVoucher) {
      return this.orderType === 'delivery' ? this.rawShippingFee : 0;
    }

    const minSpend = Number(this.appliedVoucher.minSpend) || 0;
    if (this.subtotal >= minSpend) {
      const match = (this.appliedVoucher.headline || '').match(/\d+/);
      const flatOff = match ? parseInt(match[0], 10) : 0;
      return Math.min(this.subtotal, flatOff);
    }

    return 0;
  }

  get finalShippingFee(): number {
    if (this.orderType !== 'delivery') return 0;
    if (this.isFreeShippingVoucher) {
      return 0;
    }
    return this.rawShippingFee;
  }

  get totalAmount(): number {
    const nonShippingDiscount = !this.isFreeShippingVoucher ? this.discountAmount : 0;
    const total = this.subtotal + this.finalShippingFee - nonShippingDiscount;
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
  // QR CASHIER MODAL ACTIONS (XENDIT QR PH)
  // ============================================

  get formattedCashierTimer(): string {
    const mins = Math.floor(this.cashierSecondsLeft / 60);
    const secs = this.cashierSecondsLeft % 60;
    return `${mins}min ${secs < 10 ? '0' + secs : secs}s`;
  }

  private async openQrCashierModal(orderId: string) {
    this.cashierOrderId = orderId;
    this.cashierTransactionId = `TXN${Date.now().toString().slice(-10)}`;
    this.cashierQrId = '';
    this.cashierOrderTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.cashierDescription = this.checkoutItems.map(i => `${i.quantity}x ${i.food.name}`).join(', ');
    this.gcashReferenceNumber = '';
    this.cashierQrImageUrl = '';

    const loading = await this.loadingCtrl.create({
      message: `Generating Xendit QR Ph for ₱${this.totalAmount.toFixed(2)}...`,
    });
    await loading.present();

    try {
      const response = await fetch(`${this.XENDIT_BACKEND_URL}/api/create-qrph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPhp: this.totalAmount,
          orderId: this.cashierOrderId,
          description: `Order #${this.cashierOrderId}: ${this.cashierDescription}`.slice(0, 250),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.qrImageUrl) {
        throw new Error(data.error || 'Could not generate Xendit QR Ph code');
      }

      this.cashierQrId = data.qrId;
      this.cashierQrImageUrl = data.qrImageUrl; // Base64 QR Ph image with exact amount embedded
    } catch (err) {
      console.error('Xendit QR Ph generation failed:', err);
      if (this.adminGcash.qrImage) {
        this.cashierQrImageUrl = this.adminGcash.qrImage;
        this.showToast('Using uploaded store QR (Xendit server unavailable).', 'warning');
      } else {
        await loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Xendit QR Ph Setup Required',
          message: 'Could not reach the Xendit backend to generate a pre-filled QR code. Check XENDIT_BACKEND_URL or upload a real GCash QR image in Admin settings.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }
    } finally {
      await loading.dismiss();
    }

    this.cashierSecondsLeft = 15 * 60;
    this.stopCashierTimer();
    this.cashierTimerHandle = setInterval(() => {
      if (this.cashierSecondsLeft > 0) {
        this.cashierSecondsLeft--;
      } else {
        this.stopCashierTimer();
      }
    }, 1000);

    this.isQrCashierOpen = true;
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
    try {
      await navigator.clipboard.writeText(cleanNum);
      this.showToast(`GCash number (${cleanNum}) copied!`, 'success');
    } catch {
      this.showToast(`GCash Number: ${cleanNum}`, 'dark');
    }
  }

  async openInGcash() {
    const cleanNum = this.adminGcash.number.replace(/-/g, '');
    try {
      await navigator.clipboard.writeText(cleanNum);
    } catch {}

    if (Capacitor.isNativePlatform()) {
      this.showToast(`Number ${cleanNum} copied! Opening GCash — send exact ₱${this.totalAmount.toFixed(2)}.`, 'success');
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
      this.showToast(`Number ${cleanNum} copied! Opening GCash — send exact ₱${this.totalAmount.toFixed(2)}.`, 'success');
      window.location.href = 'intent://#Intent;scheme=gcash;package=com.globe.gcash.android;end';
      return;
    }

    if (isIOS) {
      this.showToast(`Number ${cleanNum} copied! Opening GCash — send exact ₱${this.totalAmount.toFixed(2)}.`, 'success');
      window.location.href = 'gcash://';
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Send via GCash App',
      subHeader: `Number Copied: ${cleanNum}`,
      message: `Open GCash on your phone → tap QR → Upload QR (or send to ${cleanNum}) for ₱${this.totalAmount.toFixed(2)}.`,
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
        a.download = `qr-payment-${this.cashierOrderId}.png`;
        a.click();
      } else {
        const res = await fetch(this.cashierQrImageUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `qr-payment-${this.cashierOrderId}.png`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
      this.showToast('QR Code saved! Open GCash → QR → Upload QR from Gallery.', 'success');
    } catch {
      window.open(this.cashierQrImageUrl, '_blank');
    }
  }

  async confirmQrPaymentAndPlaceOrder() {
    // If Xendit QR Ph is active, verify payment status automatically with Xendit
    if (this.cashierQrId) {
      const loading = await this.loadingCtrl.create({
        message: 'Verifying QR Ph payment with Xendit...',
      });
      await loading.present();

      try {
        const resp = await fetch(
          `${this.XENDIT_BACKEND_URL}/api/check-payment/${this.cashierQrId}`
        );
        const data = await resp.json();

        if (!data.paid && data.status !== 'SUCCEEDED') {
          await loading.dismiss();
          this.showToast('Payment not completed yet. Please scan and pay the QR Ph code first.', 'warning');
          return;
        }

        const verifiedRef = data.paymentId || this.cashierQrId;
        await loading.dismiss();
        const orderId = this.cashierOrderId || Math.floor(100000 + Math.random() * 900000).toString();
        this.closeQrCashier();
        await this.finalizeOrderRecord(orderId, verifiedRef);
        return;
      } catch (err) {
        await loading.dismiss();
        this.showToast('Could not verify payment status with Xendit. Please try again.', 'danger');
        return;
      }
    }

    // Fallback: manual reference number verification when using static uploaded QR
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
      ctx.fillText('QR CASHIER • PAYMENT DETAILS', 24, 44);

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
      ctx.fillText(`To GCash: ${this.adminGcash.number}`, 24, 254);
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

      const store = this.getStoreLocation();
      const calculatedKm = this.calculateDistance(
        store.latitude,
        store.longitude,
        pos.coords.latitude,
        pos.coords.longitude
      );

      this.distanceInKm = Math.max(1.0, Math.round(calculatedKm * 10) / 10);

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
      discountAmount: this.discountAmount,
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

    if (this.paymentMethod === 'shopeepay') {
      this.walletService.deduct(this.totalAmount);
    }

    localStorage.removeItem('applied_voucher');

    let paymentText = '';
    if (this.paymentMethod === 'shopeepay') {
      paymentText = 'Wallet (Paid Instantly)';
    } else if (this.paymentMethod === 'cod') {
      paymentText = this.orderType === 'delivery' ? 'Cash on Delivery (COD)' : this.orderType === 'dine-in' ? 'Cash (Counter/Table)' : 'Cash upon Pick-Up';
    } else {
      paymentText = `QR Payment (Ref: ${gcashRef})`;
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