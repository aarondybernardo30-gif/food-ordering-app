import { Component, OnInit, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  mailOutline,
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
  pricetagOutline
} from 'ionicons/icons';
import { OrderService } from '../../services/order';
import { WalletService } from '../../services/wallet';
import { ThemeService } from '../../services/theme.service';
import { TopUpService } from '../../services/topup';
import { AuthService } from '../../services/auth';
import { Order } from '../../models/food.model';
import { UserBottomNavComponent } from '../../user-bottom-nav/user-bottom-nav.component';

export interface VoucherItem {
  id?: string;
  code: string;
  headline: string;
  title: string;
  description: string;
  minSpend: number;
  expiry: string;
  category: 'shipping' | 'discount' | 'cashback';
  tag: string;
  isUsed?: boolean;
}

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
  private orderService = inject(OrderService, { optional: true });
  public walletService: any = inject(WalletService, { optional: true });
  private authService = inject(AuthService);
  public themeService = inject(ThemeService);
  private topupService = inject(TopUpService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Profile metadata
  username: string = 'manong';
  currentUserEmail: string = 'manong@foodordering.com';
  userTier: string = 'Silver';
  isEmailVerified: boolean = false;
  showEmailBanner: boolean = true;

  // Wallet balances
  shopeePayBalance: number = 132.0;

  // Orders lists
  allOrders: Order[] = [];
  toPayOrders: Order[] = [];
  toShipOrders: Order[] = [];
  toReceiveOrders: Order[] = [];
  toRateOrders: Order[] = [];

  // Purchase Modal
  isPurchaseModalOpen: boolean = false;
  selectedModalType: 'toPay' | 'toShip' | 'toReceive' | 'toRate' | 'all' = 'toPay';

  // ============================================
  // VOUCHER SYSTEM STATE
  // ============================================
  isVouchersModalOpen: boolean = false;
  selectedVoucherTab: 'all' | 'shipping' | 'discount' | 'cashback' = 'all';
  claimVoucherCode: string = '';
  returnUrl: string | null = null;
  private isReturningToCheckout: boolean = false;

  myVouchers: VoucherItem[] = [
    {
      id: 'v1',
      code: 'FREESHIP',
      headline: 'FREE SHIPPING',
      title: 'Free Delivery Special',
      description: 'Waives 100% of standard delivery fee on orders above ₱250.',
      minSpend: 250,
      expiry: 'Valid until Dec 31, 2026',
      category: 'shipping',
      tag: 'SHOPEEPAY EXCLUSIVE'
    },
    {
      id: 'v2',
      code: 'TASTYSAVE',
      headline: '₱50 OFF',
      title: 'Lunch & Dinner Feast',
      description: 'Get an instant ₱50 deduction on all combo and family platters.',
      minSpend: 300,
      expiry: 'Valid until Dec 31, 2026',
      category: 'discount',
      tag: 'HOT DEAL'
    },
    {
      id: 'v3',
      code: 'CASHBACK15',
      headline: '15% BACK',
      title: 'Wallet Cashback Bonus',
      description: 'Earn 15% wallet credit rebate immediately credited on delivered order.',
      minSpend: 200,
      expiry: 'Valid until Dec 15, 2026',
      category: 'cashback',
      tag: 'LIMITED VOUCHER'
    },
    {
      id: 'v4',
      code: 'QUICKPICK',
      headline: '₱30 OFF',
      title: 'Pick-Up Express Discount',
      description: 'Save ₱30 when ordering ahead for takeaway or dine-in counter pickup.',
      minSpend: 150,
      expiry: 'Valid until Dec 20, 2026',
      category: 'discount',
      tag: 'PICK-UP ONLY'
    },
    {
      id: 'v5',
      code: 'SUPERZERO',
      headline: 'FREE DELIV',
      title: 'No Min. Spend Delivery',
      description: 'Enjoy free delivery for breakfast snacks and beverages.',
      minSpend: 0,
      expiry: 'Valid until Dec 31, 2026',
      category: 'shipping',
      tag: 'SPECIAL PROMO'
    }
  ];

  get vouchersCount(): number {
    return this.myVouchers.filter((v) => !v.isUsed).length;
  }

  get filteredVouchers(): VoucherItem[] {
    if (this.selectedVoucherTab === 'all') return this.myVouchers;
    return this.myVouchers.filter((v) => v.category === this.selectedVoucherTab);
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
      chatbubbleEllipsesOutline,
      chevronForwardOutline,
      mailOutline,
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
      pricetagOutline
    });
  }

  ngOnInit() {
    // 1. Live wallet balance
    const ws: any = this.walletService;
    if (ws) {
      if (ws.balance$?.subscribe) {
        ws.balance$.subscribe((bal: number) => {
          this.shopeePayBalance = bal;
        });
      } else if (typeof ws.getBalance === 'function') {
        this.shopeePayBalance = ws.getBalance();
      }
    }

    // 2. Orders subscription
    if (this.orderService && this.orderService.orders$) {
      this.orderService.orders$.subscribe((orders: Order[]) => {
        this.allOrders = orders || [];

        this.toPayOrders = this.allOrders.filter(
          (o: Order) => o.status === 'Pending' && o.paymentMethod !== 'shopeepay'
        );

        this.toShipOrders = this.allOrders.filter(
          (o: Order) => o.status === 'Preparing'
        );

        this.toReceiveOrders = this.allOrders.filter(
          (o: Order) =>
            o.status === 'Out for Delivery' || o.status === 'Ready for Pickup'
        );

        this.toRateOrders = this.allOrders.filter(
          (o: Order) => o.status === 'Completed' && !o.rating
        );
      });
    }

    // 3. User details
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      if (currentUser.fullName) {
        this.username = currentUser.fullName;
      }
      if (currentUser.email) {
        this.currentUserEmail = currentUser.email;
      }
    }

    // 4. Dark mode subscription
    this.themeService.isDarkMode$.subscribe((dark) => {
      this.isDarkMode = dark;
    });

    // 5. Auto-open Voucher Center when coming from Checkout "Select from Me"
    this.route.queryParams.subscribe((params) => {
      if (params['openVouchers'] === 'true') {
        this.returnUrl = params['returnUrl'] || null;
        this.selectedVoucherTab = 'all';
        this.isVouchersModalOpen = true;
      }
    });
  }

  ionViewWillEnter() {
    const openVouchers = this.route.snapshot.queryParamMap.get('openVouchers');
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (openVouchers === 'true') {
      this.returnUrl = returnUrl || null;
      this.selectedVoucherTab = 'all';
      this.isVouchersModalOpen = true;
    }
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

    const existing = this.myVouchers.find((v) => v.code === code);
    if (existing) {
      if (this.returnUrl) {
        this.claimVoucherCode = '';
        this.useVoucher(existing);
        return;
      }
      this.showToast(`Voucher "${code}" is already in your wallet!`, 'warning');
      return;
    }

    // Add new voucher dynamically
    const newVoucher: VoucherItem = {
      id: 'v_' + Date.now(),
      code: code,
      headline: '₱100 OFF',
      title: 'Secret Special Reward',
      description: 'Exclusive voucher code successfully redeemed!',
      minSpend: 200,
      expiry: 'Valid for 7 Days',
      category: 'discount',
      tag: 'CLAIMED CODE'
    };
    this.myVouchers.unshift(newVoucher);

    this.claimVoucherCode = '';
    if (this.returnUrl) {
      this.useVoucher(newVoucher);
    } else {
      this.showToast(`🎉 Voucher "${code}" added to your account!`, 'success');
    }
  }

  useVoucher(voucher: VoucherItem) {
    // Save voucher to localStorage so checkout can apply it
    localStorage.setItem('applied_voucher', JSON.stringify(voucher));

    if (this.returnUrl) {
      const target = this.returnUrl;
      this.returnUrl = null;
      this.isReturningToCheckout = true;
      this.isVouchersModalOpen = false;
      this.showToast(`Voucher "${voucher.code}" applied to your order!`, 'success');
      this.router.navigateByUrl(target);
    } else {
      this.isVouchersModalOpen = false;
      this.showToast(`Voucher "${voucher.code}" selected! Redirecting to menu...`, 'success');
      this.router.navigate(['/menu']);
    }
  }

  async openTierInfo() {
    const alert = await this.alertCtrl.create({
      header: `${this.userTier} Member Benefits`,
      subHeader: 'Exclusive ShopeeFood Rewards',
      message: 'You earn 1.5x coins and get free shipping vouchers weekly as a Silver Member!',
      buttons: ['Awesome!']
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
  openPurchaseModal(type: 'toPay' | 'toShip' | 'toReceive' | 'toRate' | 'all') {
    this.selectedModalType = type;
    this.isPurchaseModalOpen = true;
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
    const comment = this.reviewComment ? this.reviewComment.trim() : 'Delicious food and fast delivery!';

    const os: any = this.orderService;
    if (typeof os?.submitOrderReview === 'function') {
      await os.submitOrderReview(currentOrder.id, this.selectedRating, comment);
    }

    this.closeRatingModal();
    this.showToast('Thank you for rating your food purchase!', 'success');
  }

  verifyEmailAction() {
    this.isEmailVerified = true;
    this.showEmailBanner = false;
    this.showToast('Email verified successfully!', 'success');
  }

  dismissEmailBanner() {
    this.showEmailBanner = false;
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