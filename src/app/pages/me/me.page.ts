import { Component, OnInit, ViewChild, inject, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonButton,
  IonBadge,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonToggle,
  ToastController,
  AlertController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  cartOutline,
  chevronForwardOutline,
  closeOutline,
  walletOutline,
  cardOutline,
  star,
  starOutline,
  checkmarkCircle,
  timeOutline,
  logOutOutline,
  receiptOutline,
  personOutline,
  moonOutline,
  sunnyOutline,
  keyOutline,
  ticketOutline,
  pricetagOutline,
  checkmarkDoneOutline,
  medalOutline
} from 'ionicons/icons';
import { OrderService } from '../../services/order';
import { CartService } from '../../services/cart';
import { WalletService } from '../../services/wallet';
import { ThemeService } from '../../services/theme.service';
import { TopUpService } from '../../services/topup';
import { AuthService } from '../../services/auth';
import { VoucherService } from '../../services/voucher';
import { MembershipService, MembershipInfo } from '../../services/membership';
import { CloudSyncService } from '../../services/cloud-sync';
import { Order, Voucher } from '../../models/food.model';
import { UserBottomNavComponent } from '../../user-bottom-nav/user-bottom-nav.component';

@Component({
  selector: 'app-me',
  templateUrl: './me.page.html',
  styleUrls: ['./me.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent,
    IonIcon,
    IonButton,
    IonBadge,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonToggle,
    UserBottomNavComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MePage implements OnInit {
  @ViewChild('vouchersModal') vouchersModal?: IonModal;

  private orderService = inject(OrderService, { optional: true });
  private cartService = inject(CartService);
  public walletService: any = inject(WalletService, { optional: true });
  private authService = inject(AuthService);
  public voucherService = inject(VoucherService);
  public membershipService = inject(MembershipService);
  public themeService = inject(ThemeService);
  private topupService = inject(TopUpService);
  private cloudSync = inject(CloudSyncService, { optional: true });
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  // Profile metadata
  username: string = 'manong';
  currentUserEmail: string = 'manong@foodordering.com';
  userTier: string = 'Starter';
  membership: MembershipInfo | null = this.membershipService.getCurrentMembership();

  // Cart & Wallet
  cartCount: number = 0;
  shopeePayBalance: number = 132.0;

  // Orders lists
  allOrders: Order[] = [];
  toPayOrders: Order[] = [];
  toShipOrders: Order[] = [];
  toReceiveOrders: Order[] = [];
  toRateOrders: Order[] = [];
  completedOrders: Order[] = [];
  private seenCompletedIds = new Set<string>();

  // Purchase Modal
  isPurchaseModalOpen: boolean = false;
  selectedModalType: 'toPay' | 'toShip' | 'toReceive' | 'toRate' | 'completed' | 'all' = 'toPay';

  // ============================================
  // VOUCHER SYSTEM STATE
  // ============================================
  isVouchersModalOpen: boolean = false;
  selectedVoucherTab: 'all' | 'shipping' | 'discount' | 'cashback' = 'all';
  claimVoucherCode: string = '';
  returnUrl: string | null = null;
  checkoutSubtotal: number | null = null;
  checkoutOrderType: Order['orderType'] | null = null;
  private isReturningToCheckout: boolean = false;

  /** All admin-issued vouchers (from VoucherService). */
  allVouchers: Voucher[] = [];

  /** Vouchers this customer can use; when opened from Place Order, filters out non-applicable ones. */
  get availableVouchers(): Voucher[] {
    const unused = this.voucherService.availableFor(this.customerKey);
    if (this.returnUrl && this.checkoutSubtotal !== null && this.checkoutOrderType) {
      return unused.filter((v) =>
        this.voucherService.isVoucherApplicable(v, this.checkoutSubtotal!, this.checkoutOrderType!)
      );
    }
    return unused;
  }

  get vouchersCount(): number {
    return this.availableVouchers.length;
  }

  get filteredVouchers(): Voucher[] {
    if (this.selectedVoucherTab === 'all') return this.availableVouchers;
    return this.availableVouchers.filter((v) => v.category === this.selectedVoucherTab);
  }

  /** Stable per-customer key used for voucher & seen-completed tracking. */
  get customerKey(): string {
    const user = this.authService.getCurrentUser();
    return (user && (user.phone || user.fullName)) || 'guest';
  }

  get unseenCompletedCount(): number {
    return this.completedOrders.filter((o) => !this.seenCompletedIds.has(String(o.id))).length;
  }

  // Rating Modal
  isRatingModalOpen: boolean = false;
  orderToRate: Order | null = null;
  selectedRating: number = 5;
  reviewComment: string = '';

  // Settings Drawer & Theme
  isSettingsDrawerOpen: boolean = false;
  isDarkMode: boolean = false;

  constructor() {
    addIcons({
      settingsOutline,
      cartOutline,
      chevronForwardOutline,
      closeOutline,
      walletOutline,
      cardOutline,
      star,
      starOutline,
      checkmarkCircle,
      timeOutline,
      logOutOutline,
      receiptOutline,
      personOutline,
      moonOutline,
      sunnyOutline,
      keyOutline,
      checkmarkDoneOutline,
      ticketOutline,
      pricetagOutline,
      medalOutline
    });
  }

  ngOnInit() {
    this.loadSeenCompletedIds();

    // 0. Live cart count for top-right cart icon
    this.cartService.cart$.subscribe((items) => {
      this.cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
      this.cdr.detectChanges();
    });
    this.updateCartCount();

    // 1. Live wallet balance
    const ws: any = this.walletService;
    if (ws) {
      if (ws.balance$?.subscribe) {
        ws.balance$.subscribe((bal: number) => {
          this.shopeePayBalance = bal;
          this.cdr.detectChanges();
        });
      } else if (typeof ws.getBalance === 'function') {
        this.shopeePayBalance = ws.getBalance();
      }
    }

    // 2. Orders subscription + live membership evaluation
    if (this.orderService && this.orderService.orders$) {
      this.orderService.orders$.subscribe((orders: Order[]) => {
        this.applyOrdersList(orders || []);
      });
    }

    // 2a. Membership stream fallback
    this.membershipService.membership$.subscribe((info) => {
      this.membership = info;
      this.userTier = info.tier;
      this.cdr.detectChanges();
    });

    // 2b. Admin-issued vouchers (real-time via VoucherService)
    this.voucherService.vouchers$.subscribe((vouchers) => {
      this.allVouchers = vouchers || [];
      this.cdr.detectChanges();
    });

    // 3. User details (live)
    this.authService.currentUser$.subscribe((currentUser) => {
      if (currentUser) {
        if (currentUser.fullName) this.username = currentUser.fullName;
        if (currentUser.email) this.currentUserEmail = currentUser.email;
        this.loadSeenCompletedIds();
        this.membership = this.membershipService.refresh(this.allOrders);
        this.userTier = this.membership.tier;
        this.cdr.detectChanges();
      }
    });

    // 4. Dark mode subscription
    this.themeService.isDarkMode$.subscribe((dark) => {
      this.isDarkMode = dark;
      this.cdr.detectChanges();
    });

    // 5. Auto-open Voucher Center when coming from Checkout "Select from Me"
    this.route.queryParams.subscribe((params) => {
      if (params['openVouchers'] === 'true') {
        this.applyCheckoutParams(params);
        this.selectedVoucherTab = 'all';
        this.isVouchersModalOpen = true;
        this.cdr.detectChanges();
      }
    });
  }

  ionViewWillEnter() {
    this.loadSeenCompletedIds();
    this.updateCartCount();
    this.membership = this.membershipService.refresh(this.allOrders);
    this.userTier = this.membership.tier;

    void this.cloudSync?.syncFromCloudDelta();

    const snap = this.route.snapshot.queryParams;
    if (snap['openVouchers'] === 'true') {
      this.applyCheckoutParams(snap);
      this.selectedVoucherTab = 'all';
      this.isVouchersModalOpen = true;
    }
    this.cdr.detectChanges();
  }

  /**
   * Cash on Delivery (cod), Wallet (shopeepay), and already-submitted QR payments
   * should not show up under "Orders To Pay".
   */
  private isOrderSettledOrCod(order: Order): boolean {
    if (!order) return false;
    if (order.paymentMethod === 'cod') return true;
    if (order.paymentMethod === 'shopeepay') return true;
    if (
      order.paymentMethod === 'online' &&
      Boolean(order.paymentProof || (order.notes && order.notes.includes('QR Payment Ref:')))
    ) {
      return true;
    }
    return false;
  }

  private applyOrdersList(orders: Order[]) {
    this.allOrders = orders || [];

    this.toPayOrders = this.allOrders.filter(
      (o: Order) => o.status === 'Pending' && !this.isOrderSettledOrCod(o)
    );

    this.toShipOrders = this.allOrders.filter(
      (o: Order) =>
        o.status === 'Preparing' ||
        (o.status === 'Pending' && this.isOrderSettledOrCod(o))
    );

    this.toReceiveOrders = this.allOrders.filter(
      (o: Order) =>
        o.status === 'Out for Delivery' || o.status === 'Ready for Pickup'
    );

    this.toRateOrders = this.allOrders.filter(
      (o: Order) => o.status === 'Completed' && !o.rating
    );

    this.completedOrders = this.allOrders.filter(
      (o: Order) => o.status === 'Completed'
    );

    this.membership = this.membershipService.refresh(this.allOrders);
    this.userTier = this.membership.tier;
    this.cdr.detectChanges();
  }

  itemLineTotal(item: any): number {
    const unit = item?.unitPrice ?? item?.food?.price ?? 0;
    return Number(unit) * Number(item?.quantity || 1);
  }

  orderPaymentBadge(order: Order): string {
    if (order.paymentMethod === 'cod') {
      return order.orderType === 'delivery' ? 'Pending (COD)' : 'Pending (Cash)';
    }
    if (order.paymentMethod === 'shopeepay') return 'Paid (Wallet)';
    if (order.paymentMethod === 'online') return 'Paid (QR)';
    return 'Pending';
  }

  paymentMethodLabel(order: Order): string {
    switch (order.paymentMethod) {
      case 'cod':
        return order.orderType === 'delivery'
          ? 'Cash on Delivery (COD)'
          : order.orderType === 'dine-in'
            ? 'Cash at Counter/Table'
            : 'Cash upon Pick-Up';
      case 'shopeepay':
        return 'Paid via Wallet';
      case 'online':
        return 'Paid via GCash / QR';
      default:
        return '';
    }
  }

  private seenCompletedStorageKey(): string {
    return `seen_completed_orders_${this.customerKey}`;
  }

  private loadSeenCompletedIds() {
    try {
      const raw = localStorage.getItem(this.seenCompletedStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      this.seenCompletedIds = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      this.seenCompletedIds = new Set<string>();
    }
  }

  private markCompletedOrdersAsSeen() {
    this.completedOrders.forEach((o) => this.seenCompletedIds.add(String(o.id)));
    try {
      localStorage.setItem(
        this.seenCompletedStorageKey(),
        JSON.stringify(Array.from(this.seenCompletedIds))
      );
    } catch {}
  }

  private updateCartCount() {
    this.cartCount = this.cartService
      .getCart()
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  goToCart() {
    this.router.navigate(['/cart']);
  }

  private applyCheckoutParams(params: Record<string, any>) {
    this.returnUrl = params['returnUrl'] || '/place-order';
    const sub = params['subtotal'];
    const ot = params['orderType'];
    this.checkoutSubtotal = sub !== undefined && sub !== '' && !isNaN(Number(sub)) ? Number(sub) : null;
    this.checkoutOrderType =
      ot === 'delivery' || ot === 'dine-in' || ot === 'pickup' ? ot : null;
  }

  // ==========================================
  // VOUCHER CENTER ACTIONS
  // ==========================================
  openVouchersModal() {
    this.isVouchersModalOpen = true;
  }

  closeVouchersModal() {
    this.isVouchersModalOpen = false;
    if (!this.isReturningToCheckout && this.route.snapshot.queryParamMap.get('openVouchers')) {
      this.returnUrl = null;
      this.checkoutSubtotal = null;
      this.checkoutOrderType = null;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }
    this.isReturningToCheckout = false;
  }

  setVoucherTab(tab: 'all' | 'shipping' | 'discount' | 'cashback') {
    this.selectedVoucherTab = tab;
  }

  claimCustomCode() {
    const code = (this.claimVoucherCode || '').trim().toUpperCase();
    if (!code) {
      this.showToast('Please enter a voucher code.', 'warning');
      return;
    }

    const voucher = this.voucherService.findByCode(code);
    if (!voucher) {
      this.showToast(`Voucher code "${code}" is not valid or has expired.`, 'danger');
      return;
    }

    const alreadyUsed = this.allVouchers
      .filter((v) => v.code.toUpperCase() === code)
      .some((v) => v.usedBy.some((u) => u.toLowerCase() === this.customerKey.toLowerCase()));
    if (alreadyUsed) {
      this.showToast(`You have already used voucher "${code}".`, 'warning');
      return;
    }

    if (this.returnUrl && this.checkoutSubtotal !== null && this.checkoutOrderType) {
      const reason = this.voucherService.getInapplicableReason(
        voucher,
        this.checkoutSubtotal,
        this.checkoutOrderType
      );
      if (reason) {
        this.showToast(reason, 'warning');
        return;
      }
    }

    this.claimVoucherCode = '';
    this.useVoucher(voucher);
  }

  async useVoucher(voucher: Voucher) {
    localStorage.setItem('applied_voucher', JSON.stringify(voucher));

    const shouldReturnToPlaceOrder = Boolean(
      this.returnUrl || this.checkoutOrderType || this.checkoutSubtotal !== null
    );
    const target =
      this.returnUrl && this.returnUrl.startsWith('/place-order')
        ? this.returnUrl
        : '/place-order';

    this.isReturningToCheckout = shouldReturnToPlaceOrder;
    this.returnUrl = null;
    this.checkoutSubtotal = null;
    this.checkoutOrderType = null;
    this.isVouchersModalOpen = false;

    try {
      await this.vouchersModal?.dismiss();
    } catch {}

    if (shouldReturnToPlaceOrder) {
      this.showToast(`Voucher "${voucher.code}" applied to your order!`, 'success');
      this.router.navigateByUrl(target);
    } else {
      this.showToast(`Voucher "${voucher.code}" selected! Redirecting to menu...`, 'success');
      this.router.navigate(['/menu']);
    }
  }

  async openTierInfo() {
    const m = this.membership || this.membershipService.getCurrentMembership();
    const downgradeNote = m.downgraded
      ? '\n\n⚠️ Notice: Your badge was downgraded by 1 level due to 1 week of inactivity.'
      : '';

    const alert = await this.alertCtrl.create({
      header: `${this.userTier} Member (${m.discountPercent}% OFF)`,
      subHeader: m.nextTier
        ? `${m.ordersToNext} more order(s) to reach ${m.nextTier}`
        : 'Top Tier Unlocked!',
      message:
        `Current Discount: ${m.discountPercent}% off every food order.\n\n` +
        `• Bronze (10% OFF): 10 completed orders with 4★+ rating & feedback in 2 weeks (${m.bronzeCount2Weeks}/10)\n` +
        `• Silver (20% OFF): 20 completed orders in 3 weeks (${m.silverCount3Weeks}/20)\n` +
        `• Gold (30% OFF): 40 completed orders in 4 weeks (${m.goldCount4Weeks}/40)\n\n` +
        `Note: Not placing an order for 1 week downgrades your badge by 1 level.${downgradeNote}`,
      buttons: ['Got it!']
    });
    await alert.present();
  }

  // ==========================================
  // SETTINGS DRAWER METHODS
  // ==========================================
  openSettingsDrawer() {
    this.isSettingsDrawerOpen = true;
  }

  closeSettingsDrawer() {
    this.isSettingsDrawerOpen = false;
  }

  toggleDarkMode(event?: any) {
    const isChecked = event?.detail?.checked;
    this.themeService.setDarkMode(isChecked !== undefined ? isChecked : !this.isDarkMode);
  }

  openOrdersFromSettings() {
    this.closeSettingsDrawer();
    this.openPurchaseModal('all');
  }

  async openChangeCredentialsPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Change Name & Password',
      inputs: [
        {
          name: 'fullName',
          type: 'text',
          placeholder: 'New full name',
          value: this.username
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'New password (optional)'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data) => {
            if (data.fullName && data.fullName.trim()) {
              this.username = data.fullName.trim();
              this.authService.updateProfile({
                fullName: this.username,
                password: data.password
              });
              this.showToast('Profile name updated!', 'success');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ==========================================
  // PURCHASE MODAL & PAYMENTS
  // ==========================================
  openPurchaseModal(type: 'toPay' | 'toShip' | 'toReceive' | 'toRate' | 'completed' | 'all') {
    if (type === 'completed') {
      this.markCompletedOrdersAsSeen();
    }
    this.selectedModalType = type;
    this.isPurchaseModalOpen = true;
    void this.cloudSync?.syncFromCloudDelta();
  }

  closePurchaseModal() {
    this.isPurchaseModalOpen = false;
  }

  openTopUpPrompt() {
    this.topupService.present();
  }

  async payPendingOrder(order: Order) {
    if (this.shopeePayBalance < order.totalAmount) {
      const alert = await this.alertCtrl.create({
        header: 'Insufficient Balance',
        message: `Your balance is ₱${this.shopeePayBalance.toFixed(2)}, but total is ₱${order.totalAmount.toFixed(2)}. Top up now?`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Top Up',
            handler: () => this.openTopUpPrompt()
          }
        ]
      });
      await alert.present();
      return;
    }

    const ws: any = this.walletService;
    const success = ws && typeof ws.deduct === 'function' ? ws.deduct(order.totalAmount) : true;

    if (success) {
      const os: any = this.orderService;
      if (typeof os?.updateOrderStatus === 'function') {
        os.updateOrderStatus(order.id, 'Preparing');
      }
      this.showToast(`Order #${order.id} paid successfully!`, 'success');
      this.closePurchaseModal();
    }
  }

  openRatingModal(order: Order) {
    this.orderToRate = order;
    this.selectedRating = 5;
    this.reviewComment = '';
    this.isRatingModalOpen = true;
  }

  closeRatingModal() {
    this.isRatingModalOpen = false;
    this.orderToRate = null;
  }

  setRating(starValue: number) {
    this.selectedRating = starValue;
  }

  async submitReview() {
    if (!this.orderToRate) return;
    const currentOrder = this.orderToRate;
    const comment = (this.reviewComment || '').trim();

    const os: any = this.orderService;
    if (typeof os?.submitOrderReview === 'function') {
      await os.submitOrderReview(currentOrder.id, this.selectedRating, comment);
    }

    this.membership = this.membershipService.refresh(this.allOrders);
    this.userTier = this.membership.tier;
    this.closeRatingModal();
    this.showToast('Thank you for rating your food purchase!', 'success');
  }

  async onLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Log Out',
      message: 'Are you sure you want to log out of Food Ordering?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Log Out',
          role: 'destructive',
          handler: async () => {
            this.closeSettingsDrawer();
            await this.authService.logout();
            this.showToast('Logged out successfully.', 'dark');
            this.router.navigate(['/register'], { replaceUrl: true });
          }
        }
      ]
    });
    await alert.present();
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'dark') {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2500,
      position: 'top'
    });
    await toast.present();
  }
}