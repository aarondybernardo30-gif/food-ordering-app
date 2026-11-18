import { Component, OnInit, inject, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonIcon,
  IonButton,
  IonBadge,
  IonModal,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  AlertController,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cartOutline,
  star,
  starHalf,
  starOutline,
  addCircleOutline,
  flameOutline,
  locationOutline,
  chatbubbleEllipsesOutline,
  chatbubblesOutline,
  calendarOutline,
  timeOutline,
  lockClosedOutline,
  closeOutline,
  closeCircleOutline,
  arrowBackOutline,
  expandOutline,
  checkmarkCircle,
  chevronForwardOutline,
  chevronBackOutline,
  todayOutline,
  sparklesOutline,
  walletOutline,
  receiptOutline,
  restaurantOutline,
  fastFoodOutline,
  pizzaOutline,
  iceCreamOutline,
  beerOutline,
  cubeOutline
} from 'ionicons/icons';
import { FoodService } from '../../services/food';
import { OrderService } from '../../services/order';
import { CartService } from '../../services/cart';
import { WalletService } from '../../services/wallet';
import { FeaturedMealService, FeaturedMealItem, MealSchedule } from '../../services/featured-meal';
import { ThemeService } from '../../services/theme.service';
import { BuyNowService } from '../../services/buynow';
import { CartItem, FoodItem, FoodVariation } from '../../models/food.model';
import { UserBottomNavComponent } from '../../user-bottom-nav/user-bottom-nav.component';

export interface CategoryInfo {
  name: string;
  imageUrl: string;
  image?: string;
  [key: string]: any;
}

export interface FeaturedMeal {
  id: number;
  dayBadge: string;
  dayLabel: MealSchedule;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  imageUrl: string;
  buttonText: string;
  [key: string]: any;
}

export interface DailySlide {
  dayName: string;
  subTitle: string;
  badgeLabel: string;
  type: MealSchedule;
  meals: FeaturedMeal[];
}

@Component({
  selector: 'app-menu',
  templateUrl: './menu.page.html',
  styleUrls: ['./menu.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonIcon,
    IonButton,
    IonBadge,
    IonModal,
    IonButtons,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    UserBottomNavComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MenuPage implements OnInit {
  private foodService = inject(FoodService);
  private cartService = inject(CartService);
  private featuredMealService = inject(FeaturedMealService);
  private orderService = inject(OrderService);
  private walletService: any = inject(WalletService, { optional: true });
  public themeService = inject(ThemeService);
  private buyNow = inject(BuyNowService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  foods: FoodItem[] = [];
  filteredFoods: FoodItem[] = [];
  selectedCategory: string = 'All';
  searchTerm: string = '';
  cartCount: number = 0;

  // Theme (Local lang)
  isDarkMode: boolean = false;

  // Orders
  isOrdersModalOpen: boolean = false;
  orders: any[] = [];
  activeOrder: any = null;

  // Daily Slides
  activeSlideIndex: number = 0;

  // Daily Featured Meals — managed by the admin (FEATURED MEALS tab)
  featuredMeals: FeaturedMealItem[] = [];

  isWeekendToday(): boolean {
    const day = new Date().getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  }

  private getScheduleMeta(sched: MealSchedule): {
    dayName: string; subTitle: string; badgeLabel: string; dayBadge: string; buttonText: string;
  } {
    switch (sched) {
      case 'today':
        return {
          dayName: "Today's Meals",
          subTitle: 'Freshly prepared and available for instant order',
          badgeLabel: 'TODAY',
          dayBadge: 'TODAY',
          buttonText: 'Order for Today'
        };
      case 'tomorrow':
        return {
          dayName: "Tomorrow's Meals",
          subTitle: 'Upcoming menu — available to order tomorrow',
          badgeLabel: 'TOMORROW',
          dayBadge: 'TOMORROW',
          buttonText: 'Available Tomorrow'
        };
      case 'weekend':
        return this.isWeekendToday()
          ? {
              dayName: 'Weekend Meals',
              subTitle: 'Hearty family soup and sizzling comfort meals — available today!',
              badgeLabel: 'WEEKEND MEAL',
              dayBadge: 'WEEKEND MEAL',
              buttonText: 'Order Weekend Meal'
            }
          : {
              dayName: 'Weekend Meals',
              subTitle: 'Available to order on Saturdays & Sundays only',
              badgeLabel: 'WEEKEND MEAL',
              dayBadge: 'WEEKEND MEAL',
              buttonText: 'Available on Weekends'
            };
    }
  }

  /** Groups the admin-managed featured meals into the day sliders shown to customers. */
  get dailyMealSlides(): DailySlide[] {
    const order: MealSchedule[] = ['today', 'tomorrow', 'weekend'];
    return order
      .map((sched) => {
        const meta = this.getScheduleMeta(sched);
        const meals = this.featuredMeals
          .filter((m) => m.schedule === sched)
          .map((m) => ({
            id: m.id,
            dayBadge: meta.dayBadge,
            dayLabel: sched,
            title: m.title,
            subtitle: m.subtitle,
            description: m.description,
            price: m.price,
            imageUrl: m.image,
            buttonText: meta.buttonText
          }));
        return {
          dayName: meta.dayName,
          subTitle: meta.subTitle,
          badgeLabel: meta.badgeLabel,
          type: sched,
          meals
        };
      })
      .filter((slide) => slide.meals.length > 0);
  }

  private readonly allCategoryEntry: CategoryInfo = {
    name: 'All',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=160',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=160'
  };

  // Categories (synced live with FoodService.categoryItems$)
  categories: CategoryInfo[] = [
    this.allCategoryEntry,
    { name: 'Burgers', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=160', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=160' },
    { name: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=160', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=160' },
    { name: 'Pasta', imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=160', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=160' },
    { name: 'Chicken', imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=160', image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=160' },
    { name: 'Drinks', imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=160', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=160' },
    { name: 'Desserts', imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=160', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=160' },
    { name: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=160', image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=160' }
  ];

  // Active Multi-image cards
  activeCardImageIndex: { [key: string]: number } = {};

  // ========================================================
  // CUSTOMER MODAL (OPTIONS / SIZE POPUP)
  // ========================================================
  isOptionModalOpen: boolean = false;
  isVariationModalOpen: boolean = false;
  selectedFoodForModal: FoodItem | null = null;
  chosenVariation: FoodVariation | null = null;
  chosenOptionName: string = 'Regular';
  chosenSizeName: string = 'Regular';
  computedPrice: number = 100;
  chosenOption: string = 'Regular';
  chosenQuantity: number = 1;

  selectedVariationFood: any = null;
  variationMode: string = 'add';
  variationQty: number = 1;
  selectedOptionName: string = '';
  selectedSizeName: string = 'Regular';

  // Fullscreen Viewer
  isFullScreenViewerOpen: boolean = false;
  fullScreenFood: any = null;
  fullScreenImageIndex: number = 0;
  private isDragging = false;
  private startX = 0;

  // Rate & Feedback
  isRatingModalOpen: boolean = false;
  ratingOrder: any = null;
  selectedRating: number = 0;
  reviewComment: string = '';

  // Customer Reviews Viewer Modal
  isReviewsModalOpen: boolean = false;
  reviewsModalFood: FoodItem | null = null;

  // Daily Meal Order Modal
  isMealModalOpen: boolean = false;
  selectedMeal: FeaturedMeal | null = null;
  selectedMealVariant: string = 'Regular Serving';
  mealQuantity: number = 1;

  constructor() {
    addIcons({
      cartOutline,
      star,
      starHalf,
      starOutline,
      addCircleOutline,
      flameOutline,
      locationOutline,
      chatbubbleEllipsesOutline,
      chatbubblesOutline,
      calendarOutline,
      timeOutline,
      lockClosedOutline,
      closeOutline,
      closeCircleOutline,
      arrowBackOutline,
      expandOutline,
      checkmarkCircle,
      chevronForwardOutline,
      chevronBackOutline,
      todayOutline,
      sparklesOutline,
      walletOutline,
      receiptOutline,
      restaurantOutline,
      fastFoodOutline,
      pizzaOutline,
      iceCreamOutline,
      beerOutline,
      cubeOutline
    });
  }

  ngOnInit() {
    if (this.foodService?.foods$) {
      this.foodService.foods$.subscribe((data) => {
        this.foods = data;
        this.applyFilter();
        if (this.reviewsModalFood) {
          const updated = data.find(f => String(f.id) === String(this.reviewsModalFood?.id));
          if (updated) this.reviewsModalFood = updated;
        }
        this.cdr.detectChanges();
      });
    }
    if (this.foodService?.categoryItems$) {
      this.foodService.categoryItems$.subscribe((items) => {
        if (Array.isArray(items) && items.length > 0) {
          this.categories = [this.allCategoryEntry, ...items];
          this.cdr.detectChanges();
        }
      });
    }
    this.themeService.isDarkMode$.subscribe((dark) => {
      this.isDarkMode = dark;
      this.cdr.detectChanges();
    });
    this.featuredMealService.meals$.subscribe((meals) => {
      this.featuredMeals = meals;
      if (this.activeSlideIndex >= this.dailyMealSlides.length) {
        this.activeSlideIndex = 0;
      }
      this.cdr.detectChanges();
    });
    this.cartService.cart$.subscribe((items) => {
      this.cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
      this.cdr.detectChanges();
    });
    this.updateCartCount();
    this.initOrderTracking();
  }

  ionViewWillEnter() {
    if (typeof this.foodService?.getStoredFoods === 'function') {
      this.foods = this.foodService.getStoredFoods();
    } else if (typeof this.foodService?.getFoods === 'function') {
      this.foods = this.foodService.getFoods();
    }
    if (typeof this.foodService?.getCategoryItems === 'function') {
      const items = this.foodService.getCategoryItems();
      if (items.length > 0) {
        this.categories = [this.allCategoryEntry, ...items];
      }
    }
    this.applyFilter();
    this.updateCartCount();
    this.cdr.detectChanges();
  }

  // --- Stock & Ratings Helpers ---
  getAvailableStock(food: any): number {
    if (!food) return 0;
    if (food.available === false) return 0;
    if (typeof food.stock === 'number' && !isNaN(food.stock)) {
      return Math.max(0, Math.floor(food.stock));
    }
    return 20;
  }

  isSoldOut(food: any): boolean {
    return !food || food.available === false || this.getAvailableStock(food) <= 0;
  }

  getStarIcon(rating: number | undefined, starPosition: number): string {
    const r = Number(rating ?? 5);
    if (r >= starPosition) return 'star';
    if (r >= starPosition - 0.5) return 'star-half';
    return 'star-outline';
  }

  getReviewsWithFeedback(food?: any): any[] {
    if (!food || !Array.isArray(food.reviews)) return [];
    return food.reviews.filter((rev: any) => {
      const text = (rev?.comment || '').trim();
      return (
        text.length > 0 &&
        text !== 'Delicious food and fast service!' &&
        text !== 'Delicious food and fast delivery!'
      );
    });
  }

  // --- Handlers ---
  selectCategory(category: CategoryInfo | string) {
    this.selectedCategory = typeof category === 'string' ? category : category.name;
    this.applyFilter();
  }

  setCategory(category: CategoryInfo | string) {
    this.selectCategory(category);
  }

  onSearchChange(event: any) {
    this.searchTerm = event?.detail?.value?.toLowerCase() || '';
    this.applyFilter();
  }

  filterMenu(event?: any) {
    if (event?.detail?.value !== undefined) {
      this.searchTerm = event.detail.value.toLowerCase().trim();
    }
    this.applyFilter();
  }

  applyFilter() {
    this.filteredFoods = this.foods.filter((food) => {
      const matchCat = this.selectedCategory === 'All' || food.category === this.selectedCategory;
      const matchSearch =
        !this.searchTerm ||
        food.name.toLowerCase().includes(this.searchTerm) ||
        (food.description && food.description.toLowerCase().includes(this.searchTerm));
      return matchCat && matchSearch;
    });
  }

  // --- Daily Slides ---
  nextSlide() {
    const len = this.dailyMealSlides.length;
    if (!len) return;
    this.activeSlideIndex = (this.activeSlideIndex + 1) % len;
  }

  prevSlide() {
    const len = this.dailyMealSlides.length;
    if (!len) return;
    this.activeSlideIndex = (this.activeSlideIndex - 1 + len) % len;
  }

  setSlide(index: number) {
    this.activeSlideIndex = index;
  }

  // --- Images ---
  getFoodImages(food: any): string[] {
    if (!food) return [];
    if (Array.isArray(food.images) && food.images.length > 0) return food.images;
    return food.imageUrl ? [food.imageUrl] : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'];
  }

  getCardImages(food: any): string[] {
    if (!food) return [];
    if (Array.isArray(food.images) && food.images.length > 0) return food.images;
    if (food.imageUrl) return [food.imageUrl];
    return ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'];
  }

  onCardImageScroll(event?: any, food?: any, ...args: any[]) {}

  prevCardImage(food?: any, event?: any, ...args: any[]) {
    if (event?.stopPropagation) event.stopPropagation();
    if (!food) return;
    const images = this.getCardImages(food);
    const key = String(food.id ?? food.name);
    const current = this.activeCardImageIndex[key] || 0;
    this.activeCardImageIndex[key] = (current - 1 + images.length) % images.length;
  }

  nextCardImage(food?: any, event?: any, ...args: any[]) {
    if (event?.stopPropagation) event.stopPropagation();
    if (!food) return;
    const images = this.getCardImages(food);
    const key = String(food.id ?? food.name);
    const current = this.activeCardImageIndex[key] || 0;
    this.activeCardImageIndex[key] = (current + 1) % images.length;
  }

  setCardImage(food: any, idx: number, event?: Event) {
    if (event) event.stopPropagation();
    if (!food) return;
    const key = String(food.id ?? food.name);
    this.activeCardImageIndex[key] = idx;
  }

  // --- Orders (LIVE from OrderService) ---
  private initOrderTracking() {
    this.orderService.orders$.subscribe(orders => {
      this.orders = orders || [];
      this.activeOrder =
        this.orders.find(o => o.status !== 'Completed' && o.status !== 'Cancelled') || null;
      this.cdr.detectChanges();
    });
  }

  async cancelOrder(order: any) {
    if (!order || order.status !== 'Pending') {
      this.presentToast('This order was already accepted and cannot be cancelled.');
      return;
    }

    const isWalletPaid = order.paymentMethod === 'shopeepay';
    const refundAmount = Number(order.totalAmount || order.total || 0);

    const alert = await this.alertCtrl.create({
      header: 'Cancel Order',
      message: isWalletPaid
        ? `Are you sure you want to cancel Order #${order.id}? ₱${refundAmount.toFixed(2)} will be refunded to your wallet.`
        : `Are you sure you want to cancel Order #${order.id}?`,
      buttons: [
        { text: 'Keep Order', role: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          role: 'destructive',
          handler: async () => {
            const os: any = this.orderService;
            if (typeof os?.cancelOrder === 'function') {
              await os.cancelOrder(order.id);
            } else if (typeof os?.updateOrderStatus === 'function') {
              await os.updateOrderStatus(order.id, 'Cancelled');
              if (isWalletPaid && typeof this.walletService?.topUp === 'function' && refundAmount > 0) {
                this.walletService.topUp(refundAmount);
              }
            }
            this.presentToast(`Order #${order.id} has been cancelled.`);
            this.cdr.detectChanges();
          }
        }
      ]
    });
    await alert.present();
  }

  openRatingModal(order: any) {
    this.ratingOrder = order;
    this.selectedRating = 0;
    this.reviewComment = '';
    this.isRatingModalOpen = true;
  }

  closeRatingModal() {
    this.isRatingModalOpen = false;
    this.ratingOrder = null;
  }

  setRating(stars: number) {
    this.selectedRating = stars;
  }

  async submitRating() {
    if (!this.ratingOrder || this.selectedRating === 0) {
      this.presentToast('Please tap a star rating first');
      return;
    }

    const feedback = (this.reviewComment || '').trim();
    await this.orderService.submitOrderReview(this.ratingOrder.id, this.selectedRating, feedback);

    this.presentToast('Thank you for rating your order!');
    this.closeRatingModal();
  }

  openOrdersModal() {
    this.isOrdersModalOpen = true;
  }

  closeOrdersModal() {
    this.isOrdersModalOpen = false;
  }

  getProgressStep(order: any): number {
    if (!order) return 0;
    if (typeof order.step === 'number') return order.step;
    switch ((order.status || '').toLowerCase()) {
      case 'placed':
        return 1;
      case 'preparing':
        return 2;
      case 'on the way':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  }

  // ========================================================
  // VARIATION CHOICE & SIZE HELPERS (SEPARATED & INDEPENDENT)
  // ========================================================
  getVariationChoices(food: any): string[] {
    if (!food) return ['Regular'];
    const seen = new Set<string>();
    const list: string[] = [];

    if (Array.isArray(food.variations) && food.variations.length > 0) {
      for (const v of food.variations) {
        const name = (v?.name || '').trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          list.push(name);
        }
      }
      if (list.length > 0) return list;
    }

    const opts = this.getFoodOptions(food);
    for (const opt of opts) {
      const raw = typeof opt === 'string' ? opt : opt?.name || '';
      const clean = this.cleanOptionLabel(raw).replace(/\s*\([^)]*\)\s*$/, '').trim() || raw.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        list.push(clean);
      }
    }

    return list.length > 0 ? list : ['Regular'];
  }

  getVariationSizes(food: any): string[] {
    if (!food) return ['Regular'];
    const seen = new Set<string>();
    const list: string[] = [];

    const pushSize = (sz?: string) => {
      const clean = (sz || '').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        list.push(clean);
      }
    };

    if (Array.isArray(food.variations) && food.variations.length > 0) {
      for (const v of food.variations) {
        pushSize(v?.size || 'Regular');
      }
    }

    if (Array.isArray(food.sizes) && food.sizes.length > 0) {
      for (const s of food.sizes) {
        pushSize(s);
      }
    }

    return list.length > 0 ? list : ['Regular'];
  }

  private findMatchingVariation(food: any, choiceName: string, sizeName?: string): FoodVariation | null {
    if (!food?.variations?.length) return null;
    const normalize = (value: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetName = normalize(choiceName);
    const targetSize = normalize(sizeName || '');

    if (targetSize) {
      const exact = food.variations.find(
        (v: FoodVariation) =>
          normalize(v.name) === targetName &&
          normalize(v.size || 'Regular') === targetSize
      );
      if (exact) return exact;

      const bySize = food.variations.find(
        (v: FoodVariation) => normalize(v.size || 'Regular') === targetSize
      );
      if (bySize) return bySize;
    }

    const byName = food.variations.find((v: FoodVariation) => normalize(v.name) === targetName);
    if (byName) return byName;

    return null;
  }

  // --- OPEN OPTIONS / SIZE POPUP ---
  openFoodModal(food: FoodItem) {
    if (this.isSoldOut(food)) {
      this.presentToast(`"${food.name}" is currently out of stock.`);
      return;
    }

    this.selectedFoodForModal = food;
    this.chosenQuantity = 1;

    const choices = this.getVariationChoices(food);
    const sizes = this.getVariationSizes(food);
    const firstChoice = choices[0] || 'Regular';
    const firstSize = sizes[0] || 'Regular';
    const matched = this.findMatchingVariation(food, firstChoice, firstSize);

    this.chosenVariation = matched;
    this.chosenOptionName = firstChoice;
    this.chosenSizeName = firstSize;
    this.computedPrice = this.resolveUnitPrice(food, firstChoice, firstSize);
    this.chosenOption = firstChoice;

    this.isOptionModalOpen = true;
  }

  selectChoiceName(choice: string) {
    this.chosenOptionName = choice;
    this.chosenOption = choice;
    if (!this.selectedFoodForModal) return;

    this.chosenVariation = this.findMatchingVariation(
      this.selectedFoodForModal,
      choice,
      this.chosenSizeName
    );
    this.computedPrice = this.resolveUnitPrice(
      this.selectedFoodForModal,
      choice,
      this.chosenSizeName
    );
  }

  selectChoiceSize(size: string) {
    this.chosenSizeName = size;
    if (!this.selectedFoodForModal) return;

    this.chosenVariation = this.findMatchingVariation(
      this.selectedFoodForModal,
      this.chosenOptionName,
      size
    );
    this.computedPrice = this.resolveUnitPrice(
      this.selectedFoodForModal,
      this.chosenOptionName,
      size
    );
  }

  selectVariationOption(v: FoodVariation) {
    this.chosenVariation = v;
    this.chosenOptionName = v.name;
    this.chosenSizeName = v.size || 'Regular';
    this.computedPrice = Number(v.price ?? this.selectedFoodForModal?.price ?? 0);
    this.chosenOption = v.name;
  }

  incrementQuantity() {
    const maxStock = this.getAvailableStock(this.selectedFoodForModal);
    if (maxStock > 0 && this.chosenQuantity >= maxStock) {
      this.presentToast(`Only ${maxStock} order(s) available.`);
      return;
    }
    this.chosenQuantity++;
  }

  decrementQuantity() {
    if (this.chosenQuantity > 1) {
      this.chosenQuantity--;
    }
  }

  confirmBuyNow() {
    if (this.selectedFoodForModal) {
      const optionLabel = `${this.chosenOptionName} (${this.chosenSizeName})`;
      this.executeAddToCart(
        this.selectedFoodForModal,
        optionLabel,
        this.chosenQuantity,
        this.computedPrice
      );
      this.closeOptionModal();
      this.goToCart();
    }
  }

  // --- Modals ---
  openVariationModal(food?: any, mode: any = 'add', event?: any, ...args: any[]) {
    if (this.isSoldOut(food)) {
      this.presentToast(`"${food?.name || 'Item'}" is currently out of stock.`);
      return;
    }

    this.selectedVariationFood = food;
    this.variationMode = typeof mode === 'string' ? mode : 'add';
    this.variationQty = 1;

    const choices = this.getVariationChoices(food);
    const sizes = this.getVariationSizes(food);
    this.selectedOptionName = choices[0] || 'Regular';
    this.selectedSizeName = sizes[0] || 'Regular';

    this.isVariationModalOpen = true;
  }

  closeVariationModal() {
    this.isVariationModalOpen = false;
    this.selectedVariationFood = null;
  }

  getFoodOptions(food: any): any[] {
    if (!food) return [];
    return food.options && food.options.length > 0
      ? food.options
      : ['Regular', 'Large (+₱30)', 'Special Combo (+₱50)'];
  }

  selectOption(opt: any) {
    this.selectedOptionName = typeof opt === 'string' ? opt : opt.name;
  }

  selectSize(size: string) {
    this.selectedSizeName = size;
  }

  /** Strips embedded prices from option text so chips show the name only ("Regular P90" -> "Regular"). */
  cleanOptionLabel(label: string): string {
    if (!label) return '';
    return label
      .replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Resolves the unit price for the chosen option/variation and optional size.
   */
  resolveUnitPrice(food: FoodItem, selectedOption: string, selectedSize?: string): number {
    const basePrice = Number(food?.price) || 0;
    if (!selectedOption && !selectedSize) {
      return basePrice;
    }

    const normalize = (value: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameOnly = (selectedOption || '')
      .replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, '')
      .trim();
    const normOpt = normalize(selectedOption);
    const normNameOnly = normalize(nameOnly);
    const normSize = normalize(selectedSize || '');

    if (food?.variations?.length) {
      if (normSize) {
        const exactMatch = food.variations.find(
          (v) =>
            (normalize(v.name) === normOpt || normalize(v.name) === normNameOnly) &&
            normalize(v.size || 'Regular') === normSize
        );
        if (exactMatch && exactMatch.price !== undefined && exactMatch.price !== null) {
          return Number(exactMatch.price) || 0;
        }
      }

      if (normSize) {
        const matchedBySize = food.variations.find(
          (v) => normalize(v.size || 'Regular') === normSize
        );
        if (matchedBySize && matchedBySize.price !== undefined && matchedBySize.price !== null) {
          return Number(matchedBySize.price) || 0;
        }
      }

      const matchedByName = food.variations.find(
        (v) => normalize(v.name) === normOpt || normalize(v.name) === normNameOnly
      );
      if (matchedByName && matchedByName.price !== undefined && matchedByName.price !== null) {
        return Number(matchedByName.price) || 0;
      }
    }

    const priceMatch = (selectedOption || '').match(/(?:₱|P)\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      const parsed = parseFloat(priceMatch[1]);
      return /\+\s*(?:₱|P)/i.test(selectedOption) ? basePrice + parsed : parsed;
    }

    return basePrice;
  }

  getChosenOptionPrice(): number {
    if (!this.selectedFoodForModal) {
      return 0;
    }
    return this.resolveUnitPrice(this.selectedFoodForModal, this.chosenOptionName, this.chosenSizeName);
  }

  getCalculatedVariationPrice(food?: any): number {
    const targetFood = food || this.selectedVariationFood;
    if (!targetFood) return 0;
    return (
      this.resolveUnitPrice(targetFood, this.selectedOptionName, this.selectedSizeName) *
      (this.variationQty || 1)
    );
  }

  increaseVariationQty() {
    const maxStock = this.getAvailableStock(this.selectedVariationFood);
    if (maxStock > 0 && this.variationQty >= maxStock) {
      this.presentToast(`Only ${maxStock} order(s) available.`);
      return;
    }
    this.variationQty++;
  }

  decreaseVariationQty() {
    if (this.variationQty > 1) this.variationQty--;
  }

  confirmVariationSelection() {
    if (!this.selectedVariationFood) return;
    const isBuyNow = this.variationMode === 'buy';
    const selectedChoice = this.selectedOptionName || 'Regular';
    const selectedSize = this.selectedSizeName || 'Regular';
    const optionLabel = `${selectedChoice} (${selectedSize})`;
    const unitPrice = this.resolveUnitPrice(
      this.selectedVariationFood,
      selectedChoice,
      selectedSize
    );

    if (isBuyNow) {
      this.buyNow.setItem({
        food: this.selectedVariationFood,
        quantity: this.variationQty || 1,
        selectedOption: optionLabel,
        unitPrice
      });
      this.closeVariationModal();
      setTimeout(() => this.router.navigate(['/place-order']), 400);
      return;
    }

    this.executeAddToCart(this.selectedVariationFood, optionLabel, this.variationQty, unitPrice);
    this.closeVariationModal();
  }

  openFullScreenViewer(food?: any, index: any = 0, event?: any, ...args: any[]) {
    this.fullScreenFood = food;
    this.fullScreenImageIndex = typeof index === 'number' ? index : 0;
    this.isFullScreenViewerOpen = true;
  }

  closeFullScreenViewer() {
    this.isFullScreenViewerOpen = false;
    this.fullScreenFood = null;
  }

  selectFullScreenImage(index: number) {
    this.fullScreenImageIndex = index;
  }

  nextFullScreenImage() {
    const images = this.getFoodImages(this.fullScreenFood);
    if (images.length > 0) {
      this.fullScreenImageIndex = (this.fullScreenImageIndex + 1) % images.length;
    }
  }

  prevFullScreenImage() {
    const images = this.getFoodImages(this.fullScreenFood);
    if (images.length > 0) {
      this.fullScreenImageIndex =
        (this.fullScreenImageIndex - 1 + images.length) % images.length;
    }
  }

  onFullScreenScroll(event?: any) {}

  onMouseWheel(event?: any, ...args: any[]) {
    if (event?.deltaY !== undefined) {
      if (event.deltaY > 0) this.nextFullScreenImage();
      else this.prevFullScreenImage();
    }
  }

  startMouseDrag(event?: any, ...args: any[]) {
    this.isDragging = true;
    this.startX = event?.clientX || 0;
  }

  stopMouseDrag(event?: any, ...args: any[]) {
    this.isDragging = false;
  }

  onMouseMove(event?: any, ...args: any[]) {
    if (!this.isDragging) return;
    const clientX = event?.clientX || 0;
    const diff = clientX - this.startX;
    if (diff > 50) {
      this.prevFullScreenImage();
      this.isDragging = false;
    } else if (diff < -50) {
      this.nextFullScreenImage();
      this.isDragging = false;
    }
  }

  openReviewsModal(food?: any, event?: any, ...args: any[]) {
    if (event?.stopPropagation) event.stopPropagation();
    if (!food) return;
    const fresh = this.foods.find(f => String(f.id) === String(food.id)) || food;
    this.reviewsModalFood = fresh;
    this.isReviewsModalOpen = true;
  }

  closeReviewsModal() {
    this.isReviewsModalOpen = false;
    this.reviewsModalFood = null;
  }

  formatEverydaySold(count?: any): string {
    if (count === undefined || count === null || count === '') return '0 sold today';
    const parsed = typeof count === 'number'
      ? count
      : parseInt(String(count).replace(/[^0-9]/g, ''), 10);
    const num = isNaN(parsed) ? 0 : parsed;
    return num > 999 ? `${(num / 1000).toFixed(1)}k sold today` : `${num} sold today`;
  }

  onAddFoodClicked(food: FoodItem) {
    if ((food.variations && food.variations.length > 0) || (food.options && food.options.length > 1)) {
      this.openFoodModal(food);
    } else {
      this.executeAddToCart(food, food.options ? food.options[0] : 'Regular', 1);
    }
  }

  closeOptionModal() {
    this.isOptionModalOpen = false;
    this.selectedFoodForModal = null;
    this.chosenVariation = null;
  }

  confirmModalAddToCart() {
    if (this.selectedFoodForModal) {
      const optionLabel = `${this.chosenOptionName} (${this.chosenSizeName})`;
      this.executeAddToCart(
        this.selectedFoodForModal,
        optionLabel,
        this.chosenQuantity,
        this.computedPrice
      );
      this.closeOptionModal();
    }
  }

  mealToFoodItem(meal: FeaturedMeal): FoodItem {
    return {
      id: meal.id,
      name: meal.title,
      category: 'Daily Featured',
      description: meal.description,
      price: meal.price,
      rating: 5.0,
      imageUrl: meal.imageUrl,
      options: ['Regular Serving', 'Special Combo (+Rice)'],
      variations: [
        { name: 'Regular Serving', price: meal.price },
        { name: 'Special Combo (+Rice)', price: meal.price + 30 }
      ]
    };
  }

  mealScheduleNote(meal: FeaturedMeal): string {
    switch (meal.dayLabel) {
      case 'tomorrow': return 'Available Tomorrow';
      case 'weekend': return this.isWeekendToday() ? 'Weekend Meal (Available Today)' : 'Available on Weekends';
      default: return 'Scheduled for Today';
    }
  }

  isMealOrderableToday(meal: FeaturedMeal): boolean {
    if (meal.dayLabel === 'tomorrow') return false;
    if (meal.dayLabel === 'weekend') return this.isWeekendToday();
    return true;
  }

  private getBlockedMealMessage(meal: FeaturedMeal): string {
    if (meal.dayLabel === 'weekend') {
      return 'Weekend meals cannot be ordered on weekdays. Available on Saturday & Sunday!';
    }
    return "Tomorrow's meals cannot be ordered today. Available tomorrow!";
  }

  openMealOrderModal(meal: FeaturedMeal) {
    if (!this.isMealOrderableToday(meal)) {
      this.presentToast(this.getBlockedMealMessage(meal), 'warning');
      return;
    }
    this.selectedMeal = meal;
    this.selectedMealVariant = 'Regular Serving';
    this.mealQuantity = 1;
    this.isMealModalOpen = true;
  }

  closeMealOrderModal() {
    this.isMealModalOpen = false;
    this.selectedMeal = null;
  }

  selectMealVariant(name: string) {
    this.selectedMealVariant = name;
  }

  getSelectedMealFood(): FoodItem | null {
    return this.selectedMeal ? this.mealToFoodItem(this.selectedMeal) : null;
  }

  getMealUnitPrice(): number {
    const food = this.getSelectedMealFood();
    if (!food) return 0;
    return this.resolveUnitPrice(food, this.selectedMealVariant);
  }

  getMealTotal(): number {
    return this.getMealUnitPrice() * (this.mealQuantity || 1);
  }

  increaseMealQty() {
    this.mealQuantity++;
  }

  decreaseMealQty() {
    if (this.mealQuantity > 1) this.mealQuantity--;
  }

  orderDailyMeal(meal: FeaturedMeal) {
    if (!this.isMealOrderableToday(meal)) {
      this.presentToast(this.getBlockedMealMessage(meal), 'warning');
      return;
    }
    this.executeAddToCart(
      this.mealToFoodItem(meal),
      'Regular',
      1,
      meal.price,
      this.mealScheduleNote(meal)
    );
  }

  confirmMealOrder(goCheckout: boolean = false) {
    if (!this.selectedMeal) return;
    if (!this.isMealOrderableToday(this.selectedMeal)) {
      this.presentToast(this.getBlockedMealMessage(this.selectedMeal), 'warning');
      this.closeMealOrderModal();
      return;
    }
    const food = this.getSelectedMealFood();
    if (!food) return;
    const unitPrice = this.resolveUnitPrice(food, this.selectedMealVariant);
    const note = this.mealScheduleNote(this.selectedMeal);
    const qty = this.mealQuantity || 1;

    if (goCheckout) {
      this.buyNow.setItem({
        food,
        quantity: qty,
        selectedOption: this.selectedMealVariant,
        unitPrice,
        note
      });
      this.closeMealOrderModal();
      setTimeout(() => this.router.navigate(['/place-order']), 400);
      return;
    }

    this.cartService.addToCart(food, this.selectedMealVariant, qty, unitPrice, note);
    this.updateCartCount();
    this.presentToast(`Added ${qty}x "${food.name}" (${this.selectedMealVariant}) to cart!`);
    this.closeMealOrderModal();
  }

  private executeAddToCart(
    food: FoodItem,
    selectedOption: string,
    quantity: number,
    unitPrice?: number,
    note?: string
  ) {
    const resolvedPrice =
      unitPrice !== undefined ? unitPrice : this.resolveUnitPrice(food, selectedOption);
    this.cartService.addToCart(food, selectedOption, quantity, resolvedPrice, note);
    this.updateCartCount();
    this.presentToast(`Added ${quantity}x "${food.name}" [${selectedOption}] to cart!`);
  }

  updateCartCount() {
    this.cartCount = this.cartService
      .getCart()
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  goToCart() {
    this.router.navigate(['/cart']);
  }

  private async presentToast(
    message: string,
    color: 'success' | 'warning' | 'danger' | 'dark' = 'success'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1800,
      color,
      position: 'top'
    });
    await toast.present();
  }
}