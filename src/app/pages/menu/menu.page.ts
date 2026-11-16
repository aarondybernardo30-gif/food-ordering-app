import { Component, OnInit, OnDestroy, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  ToastController,
  AlertController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cartOutline,
  star,
  starOutline,
  addCircleOutline,
  flameOutline,
  locationOutline,
  chatbubbleEllipsesOutline,
  calendarOutline,
  timeOutline,
  closeOutline,
  checkmarkCircle,
  chevronForwardOutline,
  chevronBackOutline,
  todayOutline,
  sparklesOutline,
  walletOutline,
  receiptOutline
} from 'ionicons/icons';
import { FoodService } from '../../services/food';
import { OrderService } from '../../services/order';
import { CartService } from '../../services/cart';
import { FeaturedMealService, FeaturedMealItem, MealSchedule } from '../../services/featured-meal';
import { ThemeService } from '../../services/theme.service';
import { BuyNowService } from '../../services/buynow';
import { CartItem, FoodItem } from '../../models/food.model';
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
  dayLabel: 'today' | 'tomorrow' | 'friday' | 'weekend';
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
  type: 'today' | 'tomorrow' | 'friday' | 'weekend';
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
    UserBottomNavComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MenuPage implements OnInit {
  private foodService = inject(FoodService);
  private cartService = inject(CartService);
  private featuredMealService = inject(FeaturedMealService);
  private orderService = inject(OrderService);
  public themeService = inject(ThemeService);
  private buyNow = inject(BuyNowService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);

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

  private readonly scheduleMeta: Record<MealSchedule, {
    dayName: string; subTitle: string; badgeLabel: string; dayBadge: string; buttonText: string;
  }> = {
    today: {
      dayName: "Today's Meals",
      subTitle: 'Freshly prepared and available for instant order',
      badgeLabel: 'TODAY',
      dayBadge: 'TODAY',
      buttonText: 'Order for Today'
    },
    tomorrow: {
      dayName: "Tomorrow's Meals",
      subTitle: 'Scheduled menu open for advance reservation',
      badgeLabel: 'TOMORROW',
      dayBadge: 'TOMORROW',
      buttonText: 'Pre-Order for Tomorrow'
    },
    friday: {
      dayName: 'Friday Specials',
      subTitle: 'Weekend kick-off specialties and feast platters',
      badgeLabel: 'FRIDAY SPECIAL',
      dayBadge: 'FRIDAY SPECIAL',
      buttonText: 'Pre-Order for Friday'
    },
    weekend: {
      dayName: 'Weekend Specials',
      subTitle: 'Hearty family soup and sizzling comfort meals',
      badgeLabel: 'WEEKEND SPECIAL',
      dayBadge: 'WEEKEND SPECIAL',
      buttonText: 'Pre-Order for Weekend'
    }
  };

  /** Groups the admin-managed featured meals into the day sliders shown to customers. */
  get dailyMealSlides(): DailySlide[] {
    const order: MealSchedule[] = ['today', 'tomorrow', 'friday', 'weekend'];
    return order
      .map((sched) => {
        const meta = this.scheduleMeta[sched];
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

  // Categories
  categories: CategoryInfo[] = [
    { name: 'All', imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=160', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=160' },
    { name: 'Burgers', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=160', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=160' },
    { name: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=160', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=160' },
    { name: 'Pasta', imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=160', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=160' },
    { name: 'Chicken', imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=160', image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=160' },
    { name: 'Drinks', imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=160', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=160' },
    { name: 'Desserts', imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=160', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=160' },
    { name: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=160', image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=160' }
  ];

  // Image Navigation
  activeCardImageIndex: { [key: string]: number } = {};

  // Modals
  isOptionModalOpen: boolean = false;
  isVariationModalOpen: boolean = false;
  selectedFoodForModal: FoodItem | null = null;
  selectedVariationFood: any = null;
  variationMode: string = 'add';
  variationQty: number = 1;
  selectedOptionName: string = '';
  chosenOption: string = 'Regular';
  chosenQuantity: number = 1;

  // Fullscreen Viewer
  isFullScreenViewerOpen: boolean = false;
  fullScreenFood: any = null;
  fullScreenImageIndex: number = 0;
  private isDragging = false;
  private startX = 0;

  constructor() {
    addIcons({
      cartOutline,
      star,
      starOutline,
      addCircleOutline,
      flameOutline,
      locationOutline,
      chatbubbleEllipsesOutline,
      calendarOutline,
      timeOutline,
      closeOutline,
      checkmarkCircle,
      chevronForwardOutline,
      chevronBackOutline,
      todayOutline,
      sparklesOutline,
      walletOutline,
      receiptOutline
    });
  }

  ngOnInit() {
    if (this.foodService?.foods$) {
      this.foodService.foods$.subscribe((data) => {
        this.foods = data;
        this.applyFilter();
      });
    }
    // Dark mode — follows the app-wide ThemeService (Me page toggle)
    this.themeService.isDarkMode$.subscribe((dark) => {
      this.isDarkMode = dark;
    });
    this.featuredMealService.meals$.subscribe((meals) => {
      this.featuredMeals = meals;
      // Keep the slider index valid when meals change
      if (this.activeSlideIndex >= this.dailyMealSlides.length) {
        this.activeSlideIndex = 0;
      }
    });
    this.cartService.cart$.subscribe((items) => {
      this.cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
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
    this.applyFilter();
    this.updateCartCount();
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
    this.activeSlideIndex = (this.activeSlideIndex + 1) % this.dailyMealSlides.length;
  }

  prevSlide() {
    this.activeSlideIndex =
      (this.activeSlideIndex - 1 + this.dailyMealSlides.length) % this.dailyMealSlides.length;
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

  onCardImageScroll(event?: any, food?: any, ...args: any[]) {}

  prevCardImage(food?: any, event?: any, ...args: any[]) {
    if (!food) return;
    const images = this.getFoodImages(food);
    const key = String(food.id || food.name);
    const current = this.activeCardImageIndex[key] || 0;
    this.activeCardImageIndex[key] = (current - 1 + images.length) % images.length;
  }

  nextCardImage(food?: any, event?: any, ...args: any[]) {
    if (!food) return;
    const images = this.getFoodImages(food);
    const key = String(food.id || food.name);
    const current = this.activeCardImageIndex[key] || 0;
    this.activeCardImageIndex[key] = (current + 1) % images.length;
  }

  // --- Orders (LIVE from OrderService — updates in realtime, e.g. when the
  // rider completes a delivery in another tab) ---
  private initOrderTracking() {
    this.orderService.orders$.subscribe(orders => {
      this.orders = orders || [];
      // The tracked "active" order is the most recent one that isn't finished.
      this.activeOrder = this.orders.find(o => o.status !== 'Completed') || null;
    });
  }

  // --- Rate & Feedback (for completed orders in the history modal) ---
  isRatingModalOpen: boolean = false;
  ratingOrder: any = null;
  selectedRating: number = 0;
  reviewComment: string = '';

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

    const feedback = this.reviewComment.trim() || 'Delicious food and fast service!';
    // Updates the order AND posts a review to every food in it — the menu
    // cards' star averages and review counts update instantly.
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

  // --- Modals ---
  openVariationModal(food?: any, mode: any = 'add', event?: any, ...args: any[]) {
    this.selectedVariationFood = food;
    this.variationMode = typeof mode === 'string' ? mode : 'add';
    this.variationQty = 1;
    const opts = this.getFoodOptions(food);
    this.selectedOptionName = opts.length > 0 ? (typeof opts[0] === 'string' ? opts[0] : opts[0].name) : 'Regular';
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

  /** Strips embedded prices from option text so chips show the name only ("Regular P90" -> "Regular"). */
  cleanOptionLabel(label: string): string {
    if (!label) return '';
    return label
      .replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Resolves the unit price for the chosen option/variation.
   * Matches food.variations by name first (e.g. Regular ₱50 / Sitaw Only ₱10),
   * then falls back to a price embedded in the option text
   * ("Regular P50" = absolute, "Large (+₱30)" = surcharge over the base price).
   */
  resolveUnitPrice(food: FoodItem, selectedOption: string): number {
    const basePrice = Number(food?.price) || 0;
    if (!selectedOption) {
      return basePrice;
    }

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Option strings may embed a price ("Regular P50"); strip it for name matching.
    const nameOnly = selectedOption
      .replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, '')
      .trim();

    if (food?.variations?.length) {
      const matchedVariation = food.variations.find(
        (v) => normalize(v.name) === normalize(selectedOption) || normalize(v.name) === normalize(nameOnly)
      );
      if (matchedVariation && matchedVariation.price !== undefined && matchedVariation.price !== null) {
        return Number(matchedVariation.price) || 0;
      }
    }

    const priceMatch = selectedOption.match(/(?:₱|P)\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      const parsed = parseFloat(priceMatch[1]);
      // "(+₱30)" adds a surcharge on top of the base price; "P50" is the full price.
      return /\+\s*(?:₱|P)/i.test(selectedOption) ? basePrice + parsed : parsed;
    }

    return basePrice;
  }

  /** Unit price of the option currently selected in the "Select Choice" modal. */
  getChosenOptionPrice(): number {
    if (!this.selectedFoodForModal) {
      return 0;
    }
    return this.resolveUnitPrice(this.selectedFoodForModal, this.chosenOption);
  }

  getCalculatedVariationPrice(food?: any): number {
    const targetFood = food || this.selectedVariationFood;
    if (!targetFood) return 0;
    return this.resolveUnitPrice(targetFood, this.selectedOptionName) * (this.variationQty || 1);
  }

  increaseVariationQty() {
    this.variationQty++;
  }

  decreaseVariationQty() {
    if (this.variationQty > 1) this.variationQty--;
  }

  confirmVariationSelection() {
    if (!this.selectedVariationFood) return;
    const isBuyNow = this.variationMode === 'buy';
    const selectedOption = this.selectedOptionName || 'Regular';
    const unitPrice = this.resolveUnitPrice(this.selectedVariationFood, selectedOption);

    if (isBuyNow) {
      // "Order Now" checks out ONLY this item — the cart is never read or modified.
      this.buyNow.setItem({
        food: this.selectedVariationFood,
        quantity: this.variationQty || 1,
        selectedOption,
        unitPrice
      });
      this.closeVariationModal();
      // Wait for the sheet's dismiss animation to finish before navigating —
      // navigating immediately orphans the overlay and its backdrop blocks
      // the checkout page (unclickable Confirm button).
      setTimeout(() => this.router.navigate(['/place-order']), 400);
      return;
    }

    this.executeAddToCart(this.selectedVariationFood, selectedOption, this.variationQty);
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

  async openReviewsModal(food?: any, event?: any, ...args: any[]) {
    const alert = await this.alertCtrl.create({
      header: `${food?.name || 'Item'} Reviews`,
      subHeader: '⭐ 4.9 / 5.0 (150+ ratings)',
      message: 'Fresh, delicious, and delivered promptly!',
      buttons: ['Close']
    });
    await alert.present();
  }

  formatEverydaySold(count?: any): string {
    const num = Number(count) || 48;
    return num > 999 ? `${(num / 1000).toFixed(1)}k sold` : `${num} sold today`;
  }

  onAddFoodClicked(food: FoodItem) {
    if (food.options && food.options.length > 1) {
      this.selectedFoodForModal = food;
      this.chosenOption = food.options[0];
      this.chosenQuantity = 1;
      this.isOptionModalOpen = true;
    } else {
      this.executeAddToCart(food, food.options ? food.options[0] : 'Regular', 1);
    }
  }

  closeOptionModal() {
    this.isOptionModalOpen = false;
    this.selectedFoodForModal = null;
  }

  confirmModalAddToCart() {
    if (this.selectedFoodForModal) {
      this.executeAddToCart(this.selectedFoodForModal, this.chosenOption, this.chosenQuantity);
      this.closeOptionModal();
    }
  }

  // --- Daily Meal Order Modal ---
  isMealModalOpen: boolean = false;
  selectedMeal: FeaturedMeal | null = null;
  selectedMealVariant: string = 'Regular Serving';
  mealQuantity: number = 1;

  /** Builds the synthetic FoodItem stored in the cart for a featured meal, with priced variants. */
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
      case 'tomorrow': return 'Pre-Order for Tomorrow';
      case 'friday': return 'Pre-Order for Friday';
      case 'weekend': return 'Pre-Order for Weekend';
      default: return 'Scheduled for Today';
    }
  }

  openMealOrderModal(meal: FeaturedMeal) {
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

  /** Price of the variant currently selected in the meal order popup. */
  getMealUnitPrice(): number {
    const food = this.getSelectedMealFood();
    if (!food) return 0;
    return this.resolveUnitPrice(food, this.selectedMealVariant);
  }

  /** Quantity x selected variant price, shown live in the popup. */
  getMealTotal(): number {
    return this.getMealUnitPrice() * (this.mealQuantity || 1);
  }

  increaseMealQty() {
    this.mealQuantity++;
  }

  decreaseMealQty() {
    if (this.mealQuantity > 1) this.mealQuantity--;
  }

  /** Saves the exact variant, quantity, price, and schedule — into the cart, or straight to checkout for Order Now. */
  confirmMealOrder(goCheckout: boolean = false) {
    if (!this.selectedMeal) return;
    const food = this.getSelectedMealFood();
    if (!food) return;
    const unitPrice = this.resolveUnitPrice(food, this.selectedMealVariant);
    const note = this.mealScheduleNote(this.selectedMeal);
    const qty = this.mealQuantity || 1;

    if (goCheckout) {
      // Order Now: checkout only this meal — the cart is untouched.
      this.buyNow.setItem({
        food,
        quantity: qty,
        selectedOption: this.selectedMealVariant,
        unitPrice,
        note
      });
      this.closeMealOrderModal();
      // Let the meal sheet finish dismissing before switching pages.
      setTimeout(() => this.router.navigate(['/place-order']), 400);
      return;
    }

    this.cartService.addToCart(food, this.selectedMealVariant, qty, unitPrice, note);
    this.updateCartCount();
    this.presentToast(`Added ${qty}x "${food.name}" (${this.selectedMealVariant}) to cart!`);
    this.closeMealOrderModal();
  }

  private executeAddToCart(food: FoodItem, selectedOption: string, quantity: number) {
    // Persists the exact variant and its own price (not the base price) so the
    // cart, checkout, and order records all charge the chosen variation.
    const unitPrice = this.resolveUnitPrice(food, selectedOption);
    this.cartService.addToCart(food, selectedOption, quantity, unitPrice);
    this.updateCartCount();
    this.presentToast(`Added ${quantity}x "${food.name}" to cart!`);
  }

  updateCartCount() {
    this.cartCount = this.cartService
      .getCart()
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  goToCart() {
    this.router.navigate(['/cart']);
  }

  private async presentToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }
}