import { Component, OnInit, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonContent, 
  IonSegment, 
  IonSegmentButton, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardSubtitle, 
  IonCardContent, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonButton, 
  IonIcon, 
  IonBadge, 
  IonButtons, 
  IonBackButton, 
  IonModal,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  AlertController,
  ToastController,
  LoadingController,
  ActionSheetController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  receiptOutline,
  fastFoodOutline,
  pencilOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  cashOutline,
  cardOutline,
  navigateOutline,
  bicycleOutline,
  restaurantOutline,
  logOutOutline,
  addCircleOutline,
  trashOutline,
  cameraOutline,
  imageOutline,
  bagHandleOutline,
  mapOutline,
  locateOutline,
  checkmarkDoneOutline,
  shieldCheckmarkOutline,
  pricetagOutline,
  createOutline,
  closeOutline,
  menuOutline,
  notificationsOutline,
  locationOutline,
  walletOutline as walletIconOutline
} from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { FoodService } from '../../services/food';
import { OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';
import { FeaturedMealService, FeaturedMealItem, MealSchedule } from '../../services/featured-meal';
import { WalletQrService, WalletQrSettings } from '../../services/wallet-qr';
import { TopUpService, TopUpRequest } from '../../services/topup';
import { WalletService } from '../../services/wallet';
import { FoodItem, Order, Rider, FoodVariation } from '../../models/food.model';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonContent, 
    IonSegment, 
    IonSegmentButton, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonCardContent, 
    IonList, 
    IonItem, 
    IonLabel, 
    IonButton, 
    IonIcon, 
    IonBadge, 
    IonButtons, 
    IonBackButton, 
    IonModal,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonTextarea
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminPage implements OnInit {
  private foodService = inject(FoodService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private featuredMealService = inject(FeaturedMealService);
  private walletQrService = inject(WalletQrService);
  private topupService = inject(TopUpService);
  private walletService = inject(WalletService);
  private alertCtrl: AlertController = inject(AlertController);
  private toastCtrl: ToastController = inject(ToastController);
  private loadingCtrl: LoadingController = inject(LoadingController);
  private actionSheetCtrl: ActionSheetController = inject(ActionSheetController);
  private router = inject(Router);

  selectedTab: 'orders' | 'menu' | 'featured' | 'walletqr' | 'storelocation' = 'menu';
  orders: Order[] = [];
  foods: FoodItem[] = [];
  featuredMeals: FeaturedMealItem[] = [];
  topupRequests: TopUpRequest[] = [];

  // --- NOTIFICATIONS (wallet top-up requests) ---
  isNotificationsOpen: boolean = false;

  openNotifications() {
    this.isNotificationsOpen = true;
  }

  closeNotifications() {
    this.isNotificationsOpen = false;
  }

  get pendingTopUpCount(): number {
    return this.topupRequests.filter(r => r.status === 'Pending').length;
  }

  // --- SIDEBAR NAVIGATION (burger drawer) ---
  sidebarOpen: boolean = false;

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  /** Management sections inside the burger drawer */
  readonly manageNav: ReadonlyArray<{
    key: 'menu' | 'featured' | 'walletqr' | 'storelocation';
    label: string;
    icon: string;
  }> = [
    { key: 'menu', label: 'Food Menu & Pricing', icon: 'fast-food-outline' },
    { key: 'featured', label: 'Featured Meals', icon: 'restaurant-outline' },
    { key: 'walletqr', label: 'Wallet QR', icon: 'qr-code-outline' },
    { key: 'storelocation', label: 'Store GPS Location', icon: 'location-outline' }
  ];

  selectTab(key: 'orders' | 'menu' | 'featured' | 'walletqr' | 'storelocation') {
    this.selectedTab = key;
    this.closeSidebar();
  }

  goToRiderRegistration() {
    this.closeSidebar();
    this.router.navigate(['/rider-auth']);
  }

  // --- STORE LOCATION SETTINGS STATE ---
  storeLatitude: number = 15.36356;
  storeLongitude: number = 121.06583;
  storeAddress: string = 'Store Main Kitchen';

  // --- WALLET QR STATE ---
  qrImage: string = '';
  qrWalletLabel: string = 'GCash';
  qrAccountName: string = '';
  qrAccountNumber: string = '';
  qrCity: string = 'Manila';

  // --- FEATURED MEAL EDITOR STATE ---
  isMealModalOpen: boolean = false;
  editingMealId: number | null = null;
  mealTitle: string = '';
  mealSubtitle: string = '';
  mealDescription: string = '';
  mealPrice: number | null = null;
  mealSchedule: MealSchedule = 'today';
  mealImage: string = '';

  // --- EDIT FOOD MODAL STATE ---
  isEditModalOpen: boolean = false;
  editingFood: FoodItem | null = null;
  editFoodName: string = '';
  editFoodCategory: string = 'Chicken';
  editFoodPrice: number | null = null;
  editFoodDesc: string = '';
  editFoodImages: string[] = [];

  editVariationsList: FoodVariation[] = [];
  newEditVarName: string = '';
  newEditVarPrice: number | null = null;

  constructor() {
    addIcons({
      receiptOutline,
      fastFoodOutline,
      pencilOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      cashOutline,
      cardOutline,
      navigateOutline,
      bicycleOutline,
      restaurantOutline,
      logOutOutline,
      addCircleOutline,
      trashOutline,
      cameraOutline,
      imageOutline,
      bagHandleOutline,
      mapOutline,
      locateOutline,
      checkmarkDoneOutline,
      shieldCheckmarkOutline,
      pricetagOutline,
      createOutline,
      closeOutline,
      menuOutline,
      notificationsOutline,
      locationOutline,
      walletIconOutline
    });
  }

  ngOnInit() {
    this.orderService.orders$.subscribe(data => (this.orders = data));
    this.foodService.foods$.subscribe(data => (this.foods = data));
    this.featuredMealService.meals$.subscribe(data => (this.featuredMeals = data));
    this.topupService.requests$.subscribe(data => (this.topupRequests = data));
    
    const walletQr = this.walletQrService.getSettings();
    this.qrImage = walletQr.image;
    this.qrWalletLabel = walletQr.walletLabel || 'GCash';
    this.qrAccountName = walletQr.accountName;
    this.qrAccountNumber = walletQr.accountNumber;
    this.qrCity = walletQr.city || 'Manila';

    this.loadStoreLocation();
  }

  ionViewWillEnter() {
    this.foods = this.foodService.getStoredFoods();
    this.loadStoreLocation();
  }

  // ==========================================
  // STORE LOCATION MANAGEMENT
  // ==========================================

  loadStoreLocation() {
    try {
      const saved = localStorage.getItem('store_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) {
          this.storeLatitude = parsed.latitude;
          this.storeLongitude = parsed.longitude;
          this.storeAddress = parsed.address || this.storeAddress;
        }
      }
    } catch (e) {
      console.error('Error loading store location', e);
    }
  }

  async detectStoreLocation() {
    const loading = await this.loadingCtrl.create({
      message: 'Fetching current GPS location for the store...',
    });
    await loading.present();

    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      this.storeLatitude = Number(pos.coords.latitude.toFixed(5));
      this.storeLongitude = Number(pos.coords.longitude.toFixed(5));
      this.storeAddress = `Lat: ${this.storeLatitude}, Lng: ${this.storeLongitude}`;
      this.presentToast(`Store coordinates detected: ${this.storeLatitude}, ${this.storeLongitude}`, 'success');
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: 'Location Permission',
        message: 'Could not access GPS. Please check device location permissions or enter coordinates manually.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      await loading.dismiss();
    }
  }

  saveStoreLocation() {
    if (!this.storeLatitude || !this.storeLongitude) {
      this.presentToast('Please provide valid latitude and longitude coordinates.', 'warning');
      return;
    }

    const storeData = {
      latitude: Number(this.storeLatitude),
      longitude: Number(this.storeLongitude),
      address: this.storeAddress.trim() || 'Store Main Kitchen'
    };

    localStorage.setItem('store_location', JSON.stringify(storeData));
    this.presentToast('Store GPS Location saved! Customer delivery distance is now calculated from this location.', 'success');
  }

  // ==========================================
  // FOOD MENU MANAGEMENT
  // ==========================================

  goToAddFood() {
    this.router.navigate(['/add-food']);
  }

  openEditFoodModal(food: FoodItem) {
    this.editingFood = { ...food };
    this.editFoodName = food.name;
    this.editFoodCategory = food.category || 'Chicken';
    this.editFoodPrice = food.price;
    this.editFoodDesc = food.description || '';

    const currentImages =
      food.images && food.images.length > 0
        ? [...food.images]
        : food.imageUrl
          ? [food.imageUrl]
          : [];
    this.editFoodImages = currentImages;

    if (food.variations && food.variations.length > 0) {
      this.editVariationsList = food.variations.map(v => ({ ...v }));
    } else if (food.options && food.options.length > 0) {
      this.editVariationsList = food.options.map(optStr => {
        const match = optStr.match(/(?:₱|PHP|Php)?\s*(\d+(?:\.\d+)?)/i);
        const price = match && match[1] ? parseFloat(match[1]) : food.price;
        const name = optStr.replace(/[()]/g, '').replace(/(?:₱|PHP|Php)?\s*\d+(?:\.\d+)?/gi, '').trim() || optStr;
        return { name, price };
      });
    } else {
      this.editVariationsList = [{ name: 'Regular', price: food.price }];
    }

    this.newEditVarName = '';
    this.newEditVarPrice = null;
    this.isEditModalOpen = true;
  }

  closeEditFoodModal() {
    this.isEditModalOpen = false;
    this.editingFood = null;
  }

  toggleStockInModal() {
    if (!this.editingFood) return;
    this.toggleStock(this.editingFood);
  }

  onEditImagesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height >= width && height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.75);
          this.editFoodImages.push(compressed);
        };
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  }

  removeEditImage(index: number) {
    this.editFoodImages.splice(index, 1);
  }

  async deleteFromModal() {
    if (!this.editingFood) return;
    const foodToDelete = this.editingFood;

    const alert = await this.alertCtrl.create({
      header: 'Delete Food Item',
      message: `Are you sure you want to permanently remove "${foodToDelete.name}" from the menu?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            const fs: any = this.foodService;
            if (typeof fs.deleteFoodItem === 'function') {
              fs.deleteFoodItem(foodToDelete.id);
            } else if (typeof fs.deleteFood === 'function') {
              fs.deleteFood(foodToDelete.id as any);
            }
            this.presentToast(`"${foodToDelete.name}" has been deleted.`, 'dark');
            this.closeEditFoodModal();
          }
        }
      ]
    });
    await alert.present();
  }

  addEditVariation() {
    const name = this.newEditVarName.trim().replace(/[()]/g, '');
    if (!name) {
      this.presentToast('Please enter a variation choice name (e.g. Large, Spicy).', 'warning');
      return;
    }

    const price = (this.newEditVarPrice !== null && this.newEditVarPrice >= 0)
      ? Number(this.newEditVarPrice)
      : (this.editFoodPrice ? Number(this.editFoodPrice) : 100);

    const exists = this.editVariationsList.some(v => v.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      this.presentToast(`"${name}" variation already exists.`, 'warning');
      return;
    }

    this.editVariationsList.push({ name, price });
    this.newEditVarName = '';
    this.newEditVarPrice = null;
  }

  removeEditVariation(index: number) {
    if (this.editVariationsList.length <= 1) {
      this.presentToast('At least one variation choice should remain.', 'warning');
      return;
    }
    this.editVariationsList.splice(index, 1);
  }

  async saveEditedFood() {
    if (!this.editingFood) return;

    if (!this.editFoodName.trim()) {
      this.presentToast('Please enter a valid food name.', 'warning');
      return;
    }

    if (this.editFoodPrice === null || this.editFoodPrice <= 0) {
      this.presentToast('Please enter a valid base price.', 'warning');
      return;
    }

    const basePrice = Number(this.editFoodPrice);
    const resolvedVariations: FoodVariation[] = this.editVariationsList.length > 0
      ? this.editVariationsList
      : [{ name: 'Regular', price: basePrice }];

    const formattedOptions = resolvedVariations.map((v: any) => `${v.name} P${(v.price ?? 0).toFixed(0)}`);

    const savedImages = this.editFoodImages.length > 0
      ? [...this.editFoodImages]
      : this.editingFood.imageUrl
        ? [this.editingFood.imageUrl]
        : [];

    const updatedItem: FoodItem = {
      ...this.editingFood,
      name: this.editFoodName.trim(),
      category: this.editFoodCategory || 'Chicken',
      price: basePrice,
      description: this.editFoodDesc.trim(),
      imageUrl: savedImages[0] || this.editingFood.imageUrl,
      images: savedImages,
      options: formattedOptions,
      variations: resolvedVariations
    };

    const fs: any = this.foodService;
    if (typeof fs.updateFoodItem === 'function') {
      fs.updateFoodItem(updatedItem);
    } else if (typeof fs.updateFood === 'function') {
      fs.updateFood(updatedItem);
    }

    this.presentToast(`"${updatedItem.name}" updated successfully!`, 'success');
    this.closeEditFoodModal();
  }

  toggleStock(food: FoodItem) {
    const fs: any = this.foodService;
    if (typeof fs.toggleAvailability === 'function') {
      fs.toggleAvailability(food.id as any);
    } else {
      food.available = food.available === false;
      if (typeof fs.updateFoodItem === 'function') {
        fs.updateFoodItem(food);
      }
    }
    this.presentToast(`${food.name} availability updated.`, 'dark');
  }

  // ==========================================
  // RIDERS & ORDER DISPATCH
  // ==========================================

  getRegisteredRiders(): Rider[] {
    try {
      const stored = localStorage.getItem('registered_riders');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => r && (r.fullName || r.username));
        }
      }
    } catch (e) {
      console.error('Error fetching registered riders', e);
    }
    return [];
  }

  async acceptOrder(order: Order) {
    this.orderService.updateOrderStatus(order.id, 'Preparing');
    this.presentToast(`Order #${order.id} accepted! Status set to Preparing.`, 'success');
  }

  async dispatchToRider(order: Order) {
    const riders = this.getRegisteredRiders();

    if (riders.length === 0) {
      const noRiderAlert = await this.alertCtrl.create({
        header: 'No Registered Riders Found',
        message: 'No rider accounts have been registered yet. Please register a rider account first in the Rider Portal.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Go to Rider Portal',
            handler: () => {
              this.router.navigate(['/rider-auth']);
            }
          }
        ]
      });
      await noRiderAlert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Assign Delivery Rider',
      subHeader: `Select a registered rider for Order #${order.id}`,
      inputs: riders.map((r, index) => ({
        type: 'radio',
        label: `🛵 ${r.fullName} (${r.phone})`,
        value: r,
        checked: index === 0
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'ASSIGN & DISPATCH',
          handler: async (selectedRider: Rider) => {
            if (selectedRider) {
              const riderName = selectedRider.fullName || selectedRider.username || 'Rider';
              const riderPhone = selectedRider.phone || '';

              order.assignedRiderName = riderName;
              order.assignedRiderPhone = riderPhone;
              order.status = 'Out for Delivery';

              this.persistRiderAssignment(order.id, riderName, riderPhone);
              this.orderService.updateOrderStatus(order.id, 'Out for Delivery');

              this.presentToast(`Order #${order.id} assigned to ${riderName}!`, 'warning');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private persistRiderAssignment(orderId: string, riderName: string, riderPhone: string) {
    const keys = ['app_orders', 'food_orders', 'orders'];
    for (const key of keys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          const list: Order[] = Array.isArray(parsed) ? parsed : (parsed.orders || []);
          const idx = list.findIndex(o => o.id === orderId);
          if (idx !== -1) {
            list[idx].assignedRiderName = riderName;
            list[idx].assignedRiderPhone = riderPhone;
            list[idx].status = 'Out for Delivery';
            localStorage.setItem(key, Array.isArray(parsed) ? JSON.stringify(list) : JSON.stringify({ ...parsed, orders: list }));
          }
        }
      } catch (e) {
        console.error(`Could not persist rider assignment in ${key}`, e);
      }
    }
  }

  async trackDeliveryLocation(order: Order) {
    const loading = await this.loadingCtrl.create({
      message: 'Locating Rider GPS & calculating route...',
    });
    await loading.present();

    try {
      const riderPosition = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const riderLat = riderPosition.coords.latitude;
      const riderLng = riderPosition.coords.longitude;

      let distanceText = 'GPS Coordinates Recorded';
      if (order.latitude && order.longitude) {
        const distanceKm = this.calculateDistance(riderLat, riderLng, order.latitude, order.longitude);
        distanceText = `${distanceKm.toFixed(2)} km away from customer`;
      }

      await loading.dismiss();

      const alert = await this.alertCtrl.create({
        header: 'Rider GPS Tracking',
        subHeader: `Destination: ${order.deliveryAddress || 'Customer Location'}`,
        message: `
          <strong>Rider Location:</strong> Lat ${riderLat.toFixed(4)}, Lng ${riderLng.toFixed(4)}<br/>
          <strong>Distance to Customer:</strong> ${distanceText}
        `,
        buttons: [
          { text: 'Close', role: 'cancel' },
          {
            text: 'Open Google Maps Navigation',
            handler: () => {
              if (order.latitude && order.longitude) {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank');
              } else if (order.deliveryAddress) {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`, '_blank');
              }
            }
          }
        ]
      });
      await alert.present();

    } catch (error) {
      await loading.dismiss();
      const errAlert = await this.alertCtrl.create({
        header: 'GPS Error',
        message: 'Could not access Rider GPS. Please enable location permissions.',
        buttons: ['OK']
      });
      await errAlert.present();
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

  async markDelivered(order: Order) {
    this.orderService.updateOrderStatus(order.id, 'Completed');
    this.presentToast(`Delivery Order #${order.id} marked as Delivered!`, 'success');
  }

  async changeOrderStatus(order: Order) {
    let options: any[] = [
      { label: 'Pending', type: 'radio', value: 'Pending', checked: order.status === 'Pending' },
      { label: 'Preparing', type: 'radio', value: 'Preparing', checked: order.status === 'Preparing' }
    ];

    if (order.orderType === 'delivery') {
      options.push({ label: 'Out for Delivery (Rider)', type: 'radio', value: 'Out for Delivery', checked: order.status === 'Out for Delivery' });
      options.push({ label: 'Delivered (Completed)', type: 'radio', value: 'Completed', checked: order.status === 'Completed' });
    } else if (order.orderType === 'pickup') {
      options.push({ label: 'Ready for Pick-Up', type: 'radio', value: 'Ready for Pickup', checked: order.status === 'Ready for Pickup' });
      options.push({ label: 'Picked Up (Completed)', type: 'radio', value: 'Completed', checked: order.status === 'Completed' });
    } else {
      options.push({ label: 'Served (Completed)', type: 'radio', value: 'Completed', checked: order.status === 'Completed' });
    }

    const alert = await this.alertCtrl.create({
      header: 'Update Order Status',
      inputs: options,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: (status: any) => {
            if (status) {
              this.orderService.updateOrderStatus(order.id, status);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async onAdminLogout() {
    this.authService.adminLogout();
    this.presentToast('Admin logged out.', 'dark');
    this.router.navigate(['/admin-auth']);
  }

  // ==========================================
  // ORDER DETAILS
  // ==========================================

  selectedOrder: Order | null = null;
  isOrderDetailsOpen: boolean = false;

  openOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.isOrderDetailsOpen = true;
  }

  closeOrderDetails() {
    this.isOrderDetailsOpen = false;
    this.selectedOrder = null;
  }

  variantLabel(option?: string): string {
    if (!option) return '';
    return option
      .replace(/\s*\(?\s*\+?\s*(?:₱|P)\s*\d+(?:\.\d+)?\s*\)?\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  itemUnitPrice(item: any): number {
    return item.unitPrice ?? item.food?.price ?? 0;
  }

  itemLineTotal(item: any): number {
    return this.itemUnitPrice(item) * (item.quantity || 1);
  }

  orderPaymentLabel(order: Order): string {
    switch (order.paymentMethod) {
      case 'shopeepay': return 'Wallet (Paid Instantly)';
      case 'online': return 'Online Transaction (GCash / Maya / Card)';
      case 'cod': return order.orderType === 'delivery' ? 'Cash on Delivery (COD)' : 'Cash';
      default: return '—';
    }
  }

  async openOrderActions(order: Order) {
    const buttons: any[] = [];

    if (order.status === 'Pending') {
      buttons.push({
        text: '✅ Accept (Start Preparing)',
        handler: () => { this.acceptOrder(order); }
      });
    }

    if (order.orderType === 'delivery' && !order.assignedRiderName) {
      buttons.push({
        text: '🛵 Assign Rider',
        handler: () => { this.dispatchToRider(order); }
      });
    }

    if (order.orderType === 'delivery' && order.assignedRiderName) {
      buttons.push({
        text: '📍 Track Rider GPS',
        handler: () => { this.trackDeliveryLocation(order); }
      });
    }

    if (order.status !== 'Completed') {
      buttons.push({
        text: '🏁 Mark Complete',
        handler: () => { this.markDelivered(order); }
      });
    }

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({
      header: `Order #${order.id} — ${order.status}`,
      buttons
    });
    await sheet.present();
  }

  // ==========================================
  // DAILY FEATURED MEALS
  // ==========================================

  scheduleLabel(schedule: MealSchedule): string {
    switch (schedule) {
      case 'today': return "Today's Meals";
      case 'tomorrow': return "Tomorrow's Meals";
      case 'friday': return 'Friday Specials';
      case 'weekend': return 'Weekend Specials';
      default: return schedule;
    }
  }

  openMealModal(meal?: FeaturedMealItem) {
    if (meal) {
      this.editingMealId = meal.id;
      this.mealTitle = meal.title;
      this.mealSubtitle = meal.subtitle || '';
      this.mealDescription = meal.description || '';
      this.mealPrice = meal.price;
      this.mealSchedule = meal.schedule;
      this.mealImage = meal.image || '';
    } else {
      this.editingMealId = null;
      this.mealTitle = '';
      this.mealSubtitle = '';
      this.mealDescription = '';
      this.mealPrice = null;
      this.mealSchedule = 'today';
      this.mealImage = '';
    }
    this.isMealModalOpen = true;
  }

  closeMealModal() {
    this.isMealModalOpen = false;
    this.editingMealId = null;
  }

  onMealImageSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height >= width && height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        this.mealImage = canvas.toDataURL('image/jpeg', 0.75);
      };
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async saveMeal() {
    if (!this.mealTitle.trim()) {
      this.presentToast('Please enter the meal name.', 'warning');
      return;
    }
    if (this.mealPrice === null || this.mealPrice <= 0) {
      this.presentToast('Please enter a valid price.', 'warning');
      return;
    }
    if (!this.mealImage) {
      this.presentToast('Please upload a meal picture.', 'warning');
      return;
    }

    const meal: FeaturedMealItem = {
      id: this.editingMealId || Date.now(),
      title: this.mealTitle.trim(),
      subtitle: this.mealSubtitle.trim(),
      description: this.mealDescription.trim(),
      price: Number(this.mealPrice),
      schedule: this.mealSchedule,
      image: this.mealImage
    };

    if (this.editingMealId) {
      this.featuredMealService.updateMeal(meal);
      this.presentToast(`"${meal.title}" updated! Customers see it instantly.`, 'success');
    } else {
      this.featuredMealService.addMeal(meal);
      this.presentToast(`"${meal.title}" added to the Daily Featured Meals!`, 'success');
    }
    this.closeMealModal();
  }

  async deleteMealConfirm(meal: FeaturedMealItem) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Featured Meal',
      message: `Remove "${meal.title}" from the Daily Featured Meals?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.featuredMealService.deleteMeal(meal.id);
            this.presentToast(`"${meal.title}" removed.`, 'dark');
          }
        }
      ]
    });
    await alert.present();
  }

  // ==========================================
  // WALLET TOP-UP REQUESTS
  // ==========================================

  pendingTopUps(): TopUpRequest[] {
    return this.topupRequests.filter(r => r.status === 'Pending');
  }

  async approveTopUp(req: TopUpRequest) {
    const alert = await this.alertCtrl.create({
      header: 'Approve Top-Up',
      message: `Credit ₱${req.amount.toFixed(2)} to ${req.customerName}'s wallet?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Approve',
          handler: () => {
            this.walletService.topUp(req.amount);
            this.topupService.approveRequest(req.id);
            this.presentToast(`₱${req.amount.toFixed(2)} credited to ${req.customerName}'s wallet.`, 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  async declineTopUp(req: TopUpRequest) {
    const alert = await this.alertCtrl.create({
      header: 'Decline Top-Up',
      message: `Decline ${req.customerName}'s ₱${req.amount.toFixed(2)} payment? The customer will be notified that no wallet credit was made.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Decline',
          role: 'destructive',
          handler: () => {
            this.topupService.declineRequest(req.id);
            this.presentToast('Top-up request declined.', 'dark');
          }
        }
      ]
    });
    await alert.present();
  }

  // ==========================================
  // WALLET QR
  // ==========================================

  onQrImageSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const MAX = 900;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX) {
          height *= MAX / width;
          width = MAX;
        } else if (height >= width && height > MAX) {
          width *= MAX / height;
          height = MAX;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        this.qrImage = canvas.toDataURL('image/jpeg', 0.9);
      };
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async saveWalletQr() {
    if (!this.qrImage) {
      this.presentToast('Please upload the wallet QR code image.', 'warning');
      return;
    }

    this.walletQrService.update({
      image: this.qrImage,
      walletLabel: this.qrWalletLabel.trim() || 'GCash',
      accountName: this.qrAccountName.trim(),
      accountNumber: this.qrAccountNumber.trim(),
      city: this.qrCity.trim() || 'Manila'
    });
    this.presentToast('Wallet QR saved! Customers can now scan it to top up.', 'success');
  }

  private async presentToast(message: string, color: string = 'dark') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}