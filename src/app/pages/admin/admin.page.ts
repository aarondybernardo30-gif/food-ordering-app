import { Component, OnInit, inject, ViewChild, ChangeDetectorRef, NgZone, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminSidebarComponent, AdminTabKey, AdminNavDest } from '../../components/admin-sidebar/admin-sidebar.component';
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
  statsChartOutline,
  pencilOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  cashOutline,
  cardOutline,
  navigateOutline,
  bicycleOutline,
  restaurantOutline,
  logOutOutline,
  addOutline,
  addCircleOutline,
  trashOutline,
  cameraOutline,
  imageOutline,
  imagesOutline,
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
  notificationsOffOutline,
  locationOutline,
  walletOutline as walletIconOutline,
  optionsOutline,
  eyeOutline,
  ticketOutline,
  qrCodeOutline,
  personOutline
} from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { FoodService } from '../../services/food';
import { OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';
import { FeaturedMealService, FeaturedMealItem, FeaturedMealVariation, MealSchedule } from '../../services/featured-meal';
import { VoucherService } from '../../services/voucher';
import { WalletQrService } from '../../services/wallet-qr';
import { TopUpService, TopUpRequest } from '../../services/topup';
import { WalletService } from '../../services/wallet';
import { CloudSyncService } from '../../services/cloud-sync';
import { CategoryItem, FoodItem, Order, Rider, FoodVariation, Voucher } from '../../models/food.model';

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
    IonTextarea,
    AdminSidebarComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminPage implements OnInit {
  private foodService = inject(FoodService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private featuredMealService = inject(FeaturedMealService);
  private voucherService = inject(VoucherService);
  private walletQrService = inject(WalletQrService);
  private topupService = inject(TopUpService);
  private walletService = inject(WalletService);
  private cloudSync = inject(CloudSyncService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private alertCtrl: AlertController = inject(AlertController);
  private toastCtrl: ToastController = inject(ToastController);
  private loadingCtrl: LoadingController = inject(LoadingController);
  private actionSheetCtrl: ActionSheetController = inject(ActionSheetController);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  selectedTab: 'orders' | 'menu' | 'featured' | 'walletqr' | 'storelocation' | 'vouchers' = 'orders';
  orders: Order[] = [];
  foods: FoodItem[] = [];
  categoryItems: CategoryItem[] = [];
  featuredMeals: FeaturedMealItem[] = [];
  vouchers: Voucher[] = [];
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

  // --- SIDEBAR NAVIGATION (shared burger drawer) ---
  @ViewChild(AdminSidebarComponent) adminDrawer!: AdminSidebarComponent;

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

  selectTab(key: 'orders' | 'menu' | 'featured' | 'walletqr' | 'storelocation' | 'vouchers') {
    this.selectedTab = key;
    this.cdr.detectChanges();
  }

  onDrawerNavigate(dest: AdminNavDest) {
    if (dest === 'reports') {
      this.goToReports();
    } else {
      this.goToRiderRegistration();
    }
  }

  goToRiderRegistration() {
    this.router.navigate(['/rider-auth']);
  }

  goToReports() {
    this.router.navigate(['/admin-reports']);
  }

  // --- CATEGORY MODAL STATE ---
  isCategoryModalOpen: boolean = false;
  editingCategoryOriginalName: string | null = null;
  catModalName: string = '';
  catModalImage: string = '';

  get availableCategoryNames(): string[] {
    const names = this.categoryItems.map(c => c.name);
    if (this.editFoodCategory && !names.some(n => n.toLowerCase() === this.editFoodCategory.toLowerCase())) {
      names.push(this.editFoodCategory);
    }
    return names;
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

  // --- FEATURED MEAL EDITOR STATE (Food Information + Edit Food style) ---
  isMealModalOpen: boolean = false;
  editingMealId: number | null = null;
  mealTitle: string = '';
  mealSubtitle: string = '';
  mealDescription: string = '';
  mealPrice: number | null = null;
  mealStock: number | null = 20;
  mealSchedule: MealSchedule = 'today';
  mealImage: string = '';
  mealImages: string[] = [];

  // Featured Meal Food Size Options
  mealSizesList: string[] = ['Regular'];
  newMealSizeName: string = '';

  // Featured Meal Variations & Custom Pricing
  mealVariationList: FeaturedMealVariation[] = [{ name: 'Regular', size: 'Regular', price: 100 }];
  editingMealVarIndex: number = -1;
  newMealVarName: string = '';
  newMealVarSize: string = '';
  newMealVarPrice: number | null = null;

  // --- EDIT FOOD MODAL STATE ---
  isEditModalOpen: boolean = false;
  editingFood: FoodItem | null = null;
  editFoodName: string = '';
  editFoodCategory: string = 'Chicken';
  editFoodPrice: number | null = null;
  editFoodStock: number | null = 20;
  editFoodDesc: string = '';
  editFoodImages: string[] = [];

  // Food Size Options
  readonly quickSizePresets: string[] = ['Solo', 'Regular', 'Medium', 'Large', 'Family'];
  editSizesList: string[] = [];
  newEditSizeName: string = '';

  // Variations & Custom Pricing
  editVariationsList: FoodVariation[] = [];
  editingVarIndex: number = -1;
  newEditVarSize: string = '';
  newEditVarName: string = '';
  newEditVarPrice: number | null = null;

  constructor() {
    addIcons({
      receiptOutline,
      fastFoodOutline,
      statsChartOutline,
      pencilOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      cashOutline,
      cardOutline,
      navigateOutline,
      bicycleOutline,
      restaurantOutline,
      logOutOutline,
      addOutline,
      addCircleOutline,
      trashOutline,
      cameraOutline,
      imageOutline,
      imagesOutline,
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
      notificationsOffOutline,
      locationOutline,
      walletIconOutline,
      optionsOutline,
      eyeOutline,
      ticketOutline,
      qrCodeOutline,
      personOutline
    });
  }

  ngOnInit() {
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    const validTabs: AdminTabKey[] = ['orders', 'menu', 'featured', 'walletqr', 'storelocation', 'vouchers'];
    if (tabParam && (validTabs as string[]).includes(tabParam)) {
      this.selectedTab = tabParam as AdminTabKey;
    }

    this.orderService.orders$.subscribe(data => {
      this.orders = data;
      if (this.selectedOrder) {
        const refreshed = data.find(o => o.id === this.selectedOrder?.id);
        if (refreshed) this.selectedOrder = refreshed;
      }
      this.cdr.detectChanges();
    });

    this.foodService.foods$.subscribe(data => {
      this.foods = data;
      this.cdr.detectChanges();
    });

    this.foodService.categoryItems$.subscribe(data => {
      this.categoryItems = data;
      this.cdr.detectChanges();
    });

    this.featuredMealService.meals$.subscribe(data => {
      this.featuredMeals = data;
      this.cdr.detectChanges();
    });

    this.topupService.requests$.subscribe(data => {
      this.topupRequests = data;
      this.cdr.detectChanges();
    });

    this.voucherService.vouchers$.subscribe(data => {
      this.vouchers = data;
      this.cdr.detectChanges();
    });

    this.walletQrService.settings$.subscribe(walletQr => {
      this.qrImage = walletQr.image;
      this.qrWalletLabel = walletQr.walletLabel || 'GCash';
      this.qrAccountName = walletQr.accountName;
      this.qrAccountNumber = walletQr.accountNumber;
      this.qrCity = walletQr.city || 'Manila';
      this.cdr.detectChanges();
    });

    this.cloudSync.changes$.subscribe(({ key }) => {
      if (key === 'store_location') {
        this.loadStoreLocation();
        this.cdr.detectChanges();
      }
    });

    this.loadStoreLocation();
  }

  ionViewWillEnter() {
    this.foods = this.foodService.getStoredFoods();
    this.categoryItems = this.foodService.getCategoryItems();
    this.loadStoreLocation();
    this.cdr.detectChanges();
  }

  // ==========================================
  // CATEGORY MANAGEMENT (WITH IMAGE UPLOAD)
  // ==========================================

  openCategoryModal(cat?: CategoryItem) {
    if (cat) {
      this.editingCategoryOriginalName = cat.name;
      this.catModalName = cat.name;
      this.catModalImage = cat.imageUrl || cat.image || '';
    } else {
      this.editingCategoryOriginalName = null;
      this.catModalName = '';
      this.catModalImage = '';
    }
    this.isCategoryModalOpen = true;
  }

  closeCategoryModal() {
    this.isCategoryModalOpen = false;
    this.editingCategoryOriginalName = null;
    this.catModalName = '';
    this.catModalImage = '';
  }

  onCategoryImageSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const rawDataUrl = e?.target?.result;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
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
        const resultUrl = ctx ? canvas.toDataURL('image/jpeg', 0.8) : rawDataUrl;

        this.ngZone.run(() => {
          this.catModalImage = resultUrl;
          this.cdr.detectChanges();
        });
      };
      img.onerror = () => {
        this.ngZone.run(() => {
          this.catModalImage = rawDataUrl;
          this.cdr.detectChanges();
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  saveCategoryModal() {
    const name = (this.catModalName || '').trim();
    if (!name) {
      this.presentToast('Please enter a category name.', 'warning');
      return;
    }
    if (!this.catModalImage.trim()) {
      this.presentToast('Please upload a category image.', 'warning');
      return;
    }

    if (this.editingCategoryOriginalName) {
      this.foodService.updateCategory(this.editingCategoryOriginalName, name, this.catModalImage);
      this.presentToast(`Category "${name}" updated!`, 'success');
    } else {
      const savedName = this.foodService.addCategory(name, this.catModalImage);
      if (this.isEditModalOpen) {
        this.editFoodCategory = savedName;
      }
      this.presentToast(`Category "${savedName}" added with image!`, 'success');
    }

    this.closeCategoryModal();
  }

  async deleteEditingCategory() {
    if (!this.editingCategoryOriginalName) return;
    const target = this.editingCategoryOriginalName;
    if (this.categoryItems.length <= 1) {
      this.presentToast('At least one category must remain.', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Delete Category',
      message: `Remove category "${target}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.foodService.deleteCategory(target);
            this.presentToast(`Category "${target}" deleted.`, 'dark');
            this.closeCategoryModal();
          }
        }
      ]
    });
    await alert.present();
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
      this.cdr.detectChanges();
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
    this.cloudSync.pushKey('store_location', storeData);
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
    this.editFoodStock =
      typeof food.stock === 'number' && !isNaN(food.stock)
        ? food.stock
        : (food.available === false ? 0 : 20);
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
        const priceMatch = optStr.match(/(?:₱|PHP|Php|P)\s*(\d+(?:\.\d+)?)/i);
        const price = priceMatch && priceMatch[1] ? parseFloat(priceMatch[1]) : food.price;
        const sizeMatch = optStr.match(/\(([^)]+)\)/);
        const size = sizeMatch && sizeMatch[1] ? sizeMatch[1].trim() : undefined;
        const name = optStr
          .replace(/\([^)]*\)/g, '')
          .replace(/(?:₱|PHP|Php|P)\s*\d+(?:\.\d+)?/gi, '')
          .trim() || optStr;
        return size ? { name, size, price } : { name, price };
      });
    } else {
      this.editVariationsList = [{ name: 'Regular', size: 'Regular', price: food.price }];
    }

    // Build Food Size Options from saved food.sizes + any variation sizes
    const sizeSeen = new Set<string>();
    const sizes: string[] = [];
    const pushUniqueSize = (sz?: string) => {
      const clean = (sz || '').trim();
      if (clean && !sizeSeen.has(clean.toLowerCase())) {
        sizeSeen.add(clean.toLowerCase());
        sizes.push(clean);
      }
    };
    if (Array.isArray(food.sizes)) {
      food.sizes.forEach(pushUniqueSize);
    }
    this.editVariationsList.forEach(v => pushUniqueSize(v.size));
    this.editSizesList = sizes.length > 0 ? sizes : ['Regular'];

    this.editingVarIndex = -1;
    this.newEditVarName = '';
    this.newEditVarSize = '';
    this.newEditVarPrice = null;
    this.newEditSizeName = '';
    this.isEditModalOpen = true;
  }

  closeEditFoodModal() {
    this.isEditModalOpen = false;
    this.editingFood = null;
    this.editingVarIndex = -1;
  }

  toggleStockInModal() {
    if (!this.editingFood) return;
    const nextAvailable = this.editingFood.available === false;
    this.editingFood.available = nextAvailable;
    if (nextAvailable && (this.editFoodStock === null || this.editFoodStock <= 0)) {
      this.editFoodStock = 20;
    } else if (!nextAvailable) {
      this.editFoodStock = 0;
    }
    this.toggleStock(this.editingFood);
  }

  // --- FOOD SIZE OPTIONS HANDLERS ---
  isSizeSelected(sizeName: string): boolean {
    const target = sizeName.trim().toLowerCase();
    return this.editSizesList.some(s => s.trim().toLowerCase() === target);
  }

  togglePresetSize(preset: string) {
    const target = preset.trim().toLowerCase();
    const idx = this.editSizesList.findIndex(s => s.trim().toLowerCase() === target);
    if (idx > -1) {
      if (this.editSizesList.length <= 1) {
        this.presentToast('At least one food size should remain.', 'warning');
        return;
      }
      this.editSizesList.splice(idx, 1);
    } else {
      this.editSizesList.push(preset);
    }
  }

  addEditSize() {
    const clean = (this.newEditSizeName || '').trim();
    if (!clean) {
      this.presentToast('Please enter a food size (e.g. Solo, Medium, Large).', 'warning');
      return;
    }
    if (this.isSizeSelected(clean)) {
      this.presentToast(`Size "${clean}" is already in the list.`, 'warning');
      return;
    }
    this.editSizesList.push(clean);
    this.newEditSizeName = '';
  }

  removeEditSize(index: number) {
    if (this.editSizesList.length <= 1) {
      this.presentToast('At least one food size should remain.', 'warning');
      return;
    }
    this.editSizesList.splice(index, 1);
  }

  onEditImagesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const rawDataUrl = e?.target?.result;
        if (!rawDataUrl) return;

        const img = new Image();
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
          const compressed = ctx ? canvas.toDataURL('image/jpeg', 0.75) : rawDataUrl;

          this.ngZone.run(() => {
            this.editFoodImages = [...this.editFoodImages, compressed];
            this.cdr.detectChanges();
          });
        };
        img.onerror = () => {
          this.ngZone.run(() => {
            this.editFoodImages = [...this.editFoodImages, rawDataUrl];
            this.cdr.detectChanges();
          });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }

  removeEditImage(index: number) {
    this.editFoodImages = this.editFoodImages.filter((_, i) => i !== index);
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

  editExistingVariation(index: number) {
    const v = this.editVariationsList[index];
    if (!v) return;
    this.editingVarIndex = index;
    this.newEditVarName = v.name;
    this.newEditVarSize = v.size || '';
    this.newEditVarPrice = v.price ?? this.editFoodPrice ?? 0;
  }

  cancelEditVariation() {
    this.editingVarIndex = -1;
    this.newEditVarName = '';
    this.newEditVarSize = '';
    this.newEditVarPrice = null;
  }

  addEditVariation() {
    const name = this.newEditVarName.trim().replace(/[()]/g, '');
    if (!name) {
      this.presentToast('Please enter a variation choice name (e.g. Regular, Spicy).', 'warning');
      return;
    }

    const price = (this.newEditVarPrice !== null && this.newEditVarPrice >= 0)
      ? Number(this.newEditVarPrice)
      : (this.editFoodPrice ? Number(this.editFoodPrice) : 100);

    const size = (this.newEditVarSize || '').trim();
    const exists = this.editVariationsList.some(
      (v, idx) =>
        idx !== this.editingVarIndex &&
        v.name.toLowerCase() === name.toLowerCase() &&
        (v.size || '').toLowerCase() === size.toLowerCase()
    );
    if (exists) {
      this.presentToast(`"${name}${size ? ' (' + size + ')' : ''}" already exists.`, 'warning');
      return;
    }

    const nextVariation: FoodVariation = size ? { name, size, price } : { name, price };

    if (this.editingVarIndex > -1) {
      this.editVariationsList[this.editingVarIndex] = nextVariation;
      this.editingVarIndex = -1;
      this.presentToast('Variation updated!', 'success');
    } else {
      this.editVariationsList.push(nextVariation);
    }

    if (size && !this.isSizeSelected(size)) {
      this.editSizesList.push(size);
    }

    this.newEditVarName = '';
    this.newEditVarPrice = null;
    this.newEditVarSize = '';
  }

  removeEditVariation(index: number) {
    if (this.editVariationsList.length <= 1) {
      this.presentToast('At least one variation choice should remain.', 'warning');
      return;
    }
    this.editVariationsList.splice(index, 1);
    if (this.editingVarIndex === index) {
      this.cancelEditVariation();
    } else if (this.editingVarIndex > index) {
      this.editingVarIndex--;
    }
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
    const resolvedStock = Math.max(0, Math.floor(Number(this.editFoodStock ?? 20)));
    const resolvedVariations: FoodVariation[] = this.editVariationsList.length > 0
      ? this.editVariationsList
      : [{ name: 'Regular', size: 'Regular', price: basePrice }];

    const formattedOptions = resolvedVariations.map((v: any) => {
      const sizePart = v.size ? ` (${v.size})` : '';
      return `${v.name}${sizePart} P${(v.price ?? 0).toFixed(0)}`;
    });

    const savedSizes = this.editSizesList.length > 0 ? [...this.editSizesList] : ['Regular'];

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
      stock: resolvedStock,
      available: this.editingFood.available !== false && resolvedStock > 0,
      description: this.editFoodDesc.trim(),
      imageUrl: savedImages[0] || this.editingFood.imageUrl,
      images: savedImages,
      options: formattedOptions,
      variations: resolvedVariations,
      sizes: savedSizes
    };

    const fs: any = this.foodService;
    if (typeof fs.updateFoodItem === 'function') {
      await fs.updateFoodItem(updatedItem);
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
    return this.authService.getRegisteredRiders().filter(r => r && (r.fullName || r.username));
  }

  private getActiveOrderForRider(rider: Rider): Order | undefined {
    const riderName = (rider.fullName || rider.username || '').trim().toLowerCase();
    const riderPhone = (rider.phone || '').replace(/\D/g, '');

    return this.orders.find(o => {
      if (!o || o.status === 'Completed' || o.status === 'Cancelled') return false;
      const orderRiderPhone = (o.assignedRiderPhone || '').replace(/\D/g, '');
      const orderRiderName = (o.assignedRiderName || '').trim().toLowerCase();

      if (riderPhone && orderRiderPhone && riderPhone === orderRiderPhone) return true;
      if (riderName && orderRiderName && riderName === orderRiderName) return true;
      return false;
    });
  }

  isRiderAvailable(rider: Rider): boolean {
    const r: any = rider;
    if (r?.available === false || r?.isAvailable === false || r?.status === 'unavailable') {
      return false;
    }
    return !this.getActiveOrderForRider(rider);
  }

  async acceptOrder(order: Order) {
    await this.orderService.updateOrderStatus(order.id, 'Preparing');
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

    const riderStatuses = riders.map(r => {
      const activeOrder = this.getActiveOrderForRider(r);
      const available = this.isRiderAvailable(r);
      const name = r.fullName || r.username || 'Rider';
      const phone = r.phone ? ` (${r.phone})` : '';
      const statusText = available
        ? 'Available'
        : activeOrder
          ? `Not Available (Order #${activeOrder.id})`
          : 'Not Available';
      return {
        rider: r,
        available,
        label: `${available ? '🟢' : '🔴'} ${name}${phone} — ${statusText}`
      };
    });

    const firstAvailableIdx = riderStatuses.findIndex(item => item.available);
    const hasAvailable = firstAvailableIdx !== -1;

    const alert = await this.alertCtrl.create({
      header: 'Assign Delivery Rider',
      subHeader: hasAvailable
        ? `Select an available rider for Order #${order.id}`
        : `All riders are currently busy for Order #${order.id}`,
      inputs: riderStatuses.map((item, index) => ({
        type: 'radio',
        label: item.label,
        value: item.rider,
        disabled: !item.available,
        checked: index === firstAvailableIdx
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'ASSIGN & DISPATCH',
          handler: async (selectedRider: Rider) => {
            if (!selectedRider) {
              this.presentToast('Please select an available rider.', 'warning');
              return false;
            }
            if (!this.isRiderAvailable(selectedRider)) {
              const name = selectedRider.fullName || selectedRider.username || 'Rider';
              this.presentToast(`${name} is currently not available.`, 'warning');
              return false;
            }
            const riderName = selectedRider.fullName || selectedRider.username || 'Rider';
            const riderPhone = selectedRider.phone || '';

            await this.orderService.assignRider(order.id, riderName, riderPhone);
            this.presentToast(`Order #${order.id} assigned to ${riderName}!`, 'warning');
            return true;
          }
        }
      ]
    });

    await alert.present();
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
    await this.orderService.updateOrderStatus(order.id, 'Completed');
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
  // DAILY FEATURED MEALS (FOOD INFORMATION + EDIT FOOD STYLE)
  // ==========================================

  scheduleLabel(schedule: MealSchedule): string {
    switch (schedule) {
      case 'today': return "Today's Meals";
      case 'tomorrow': return "Tomorrow's Meals";
      case 'weekend': return 'Weekend Meals';
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
      this.mealStock = typeof meal.stock === 'number' && !isNaN(meal.stock) ? meal.stock : 20;
      this.mealSchedule =
        meal.schedule === 'today' || meal.schedule === 'tomorrow' || meal.schedule === 'weekend'
          ? meal.schedule
          : 'today';
      const imgs = meal.images && meal.images.length > 0
        ? [...meal.images]
        : (meal.image ? [meal.image] : []);
      this.mealImages = imgs;
      this.mealImage = imgs[0] || '';
      this.mealVariationList = meal.variations && meal.variations.length > 0
        ? meal.variations.map(v => ({ ...v }))
        : [{ name: 'Regular', size: 'Regular', price: meal.price }];

      const sizeSeen = new Set<string>();
      const sizes: string[] = [];
      const pushUniqueSize = (sz?: string) => {
        const clean = (sz || '').trim();
        if (clean && !sizeSeen.has(clean.toLowerCase())) {
          sizeSeen.add(clean.toLowerCase());
          sizes.push(clean);
        }
      };
      if (Array.isArray(meal.sizes)) {
        meal.sizes.forEach(pushUniqueSize);
      }
      this.mealVariationList.forEach(v => pushUniqueSize(v.size));
      this.mealSizesList = sizes.length > 0 ? sizes : ['Regular'];
    } else {
      this.editingMealId = null;
      this.mealTitle = '';
      this.mealSubtitle = '';
      this.mealDescription = '';
      this.mealPrice = null;
      this.mealStock = 20;
      this.mealSchedule = 'today';
      this.mealImage = '';
      this.mealImages = [];
      this.mealVariationList = [{ name: 'Regular', size: 'Regular', price: 100 }];
      this.mealSizesList = ['Regular'];
    }
    this.editingMealVarIndex = -1;
    this.newMealVarName = '';
    this.newMealVarSize = '';
    this.newMealVarPrice = null;
    this.newMealSizeName = '';
    this.isMealModalOpen = true;
  }

  closeMealModal() {
    this.isMealModalOpen = false;
    this.editingMealId = null;
    this.editingMealVarIndex = -1;
  }

  onMealBasePriceChange() {
    const p = Number(this.mealPrice);
    if (!isNaN(p) && p > 0 && this.mealVariationList.length === 1 && this.mealVariationList[0].name === 'Regular') {
      this.mealVariationList[0].price = p;
    }
  }

  // --- FEATURED MEAL FOOD SIZE OPTIONS HANDLERS ---
  isMealSizeSelected(sizeName: string): boolean {
    const target = sizeName.trim().toLowerCase();
    return this.mealSizesList.some(s => s.trim().toLowerCase() === target);
  }

  toggleMealPresetSize(preset: string) {
    const target = preset.trim().toLowerCase();
    const idx = this.mealSizesList.findIndex(s => s.trim().toLowerCase() === target);
    if (idx > -1) {
      if (this.mealSizesList.length <= 1) {
        this.presentToast('At least one food size should remain.', 'warning');
        return;
      }
      this.mealSizesList.splice(idx, 1);
    } else {
      this.mealSizesList.push(preset);
    }
  }

  addMealSize() {
    const clean = (this.newMealSizeName || '').trim();
    if (!clean) {
      this.presentToast('Please enter a food size (e.g. Solo, Medium, Large).', 'warning');
      return;
    }
    if (this.isMealSizeSelected(clean)) {
      this.presentToast(`Size "${clean}" is already in the list.`, 'warning');
      return;
    }
    this.mealSizesList.push(clean);
    this.newMealSizeName = '';
  }

  removeMealSize(index: number) {
    if (this.mealSizesList.length <= 1) {
      this.presentToast('At least one food size should remain.', 'warning');
      return;
    }
    this.mealSizesList.splice(index, 1);
  }

  // --- FEATURED MEAL VARIATIONS & CUSTOM PRICING HANDLERS ---
  editExistingMealVariation(index: number) {
    const v = this.mealVariationList[index];
    if (!v) return;
    this.editingMealVarIndex = index;
    this.newMealVarName = v.name;
    this.newMealVarSize = v.size || '';
    this.newMealVarPrice = v.price ?? this.mealPrice ?? 0;
  }

  cancelEditMealVariation() {
    this.editingMealVarIndex = -1;
    this.newMealVarName = '';
    this.newMealVarSize = '';
    this.newMealVarPrice = null;
  }

  addOrUpdateMealVariation() {
    const name = this.newMealVarName.trim().replace(/[()]/g, '');
    if (!name) {
      this.presentToast('Please enter a variation choice name (e.g. Regular, Spicy).', 'warning');
      return;
    }

    const price = (this.newMealVarPrice !== null && this.newMealVarPrice >= 0)
      ? Number(this.newMealVarPrice)
      : (this.mealPrice ? Number(this.mealPrice) : 100);

    const size = (this.newMealVarSize || '').trim();
    const exists = this.mealVariationList.some(
      (v, idx) =>
        idx !== this.editingMealVarIndex &&
        v.name.toLowerCase() === name.toLowerCase() &&
        (v.size || '').toLowerCase() === size.toLowerCase()
    );
    if (exists) {
      this.presentToast(`"${name}${size ? ' (' + size + ')' : ''}" already exists.`, 'warning');
      return;
    }

    const entry: FeaturedMealVariation = size ? { name, size, price } : { name, price };

    if (this.editingMealVarIndex > -1) {
      this.mealVariationList[this.editingMealVarIndex] = entry;
      this.editingMealVarIndex = -1;
      this.presentToast('Variation updated!', 'success');
    } else {
      this.mealVariationList.push(entry);
    }

    if (size && !this.isMealSizeSelected(size)) {
      this.mealSizesList.push(size);
    }

    this.newMealVarName = '';
    this.newMealVarSize = '';
    this.newMealVarPrice = null;
  }

  removeMealVariation(index: number) {
    if (this.mealVariationList.length <= 1) {
      this.presentToast('At least one variation choice should remain.', 'warning');
      return;
    }
    this.mealVariationList.splice(index, 1);
    if (this.editingMealVarIndex === index) {
      this.cancelEditMealVariation();
    } else if (this.editingMealVarIndex > index) {
      this.editingMealVarIndex--;
    }
  }

  onMealImageSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const rawDataUrl = e?.target?.result;
        if (!rawDataUrl) return;

        const img = new Image();
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
          const compressed = ctx ? canvas.toDataURL('image/jpeg', 0.75) : rawDataUrl;

          this.ngZone.run(() => {
            this.mealImages = [...this.mealImages, compressed];
            this.mealImage = this.mealImages[0] || '';
            this.cdr.detectChanges();
          });
        };
        img.onerror = () => {
          this.ngZone.run(() => {
            this.mealImages = [...this.mealImages, rawDataUrl];
            this.mealImage = this.mealImages[0] || '';
            this.cdr.detectChanges();
          });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }

  removeMealPhoto(idx: number) {
    this.mealImages = this.mealImages.filter((_, i) => i !== idx);
    this.mealImage = this.mealImages[0] || '';
  }

  async saveMeal() {
    if (!this.mealTitle.trim()) {
      this.presentToast('Please enter the meal name.', 'warning');
      return;
    }
    if (this.mealPrice === null || this.mealPrice <= 0) {
      this.presentToast('Please enter a valid base price.', 'warning');
      return;
    }
    if (this.mealImages.length === 0 && !this.mealImage) {
      this.presentToast('Please upload at least one meal picture.', 'warning');
      return;
    }

    const cover = this.mealImages[0] || this.mealImage;
    const savedImages = this.mealImages.length > 0 ? [...this.mealImages] : [cover];
    const resolvedStock = Math.max(0, Math.floor(Number(this.mealStock ?? 20)));
    const resolvedVariations = this.mealVariationList.length > 0
      ? this.mealVariationList.map(v => ({ ...v }))
      : [{ name: 'Regular', size: 'Regular', price: Number(this.mealPrice) }];
    const savedMealSizes = this.mealSizesList.length > 0 ? [...this.mealSizesList] : ['Regular'];

    const meal: FeaturedMealItem = {
      id: this.editingMealId || Date.now(),
      title: this.mealTitle.trim(),
      subtitle: this.mealSubtitle.trim(),
      description: this.mealDescription.trim(),
      price: Number(this.mealPrice),
      stock: resolvedStock,
      schedule: this.mealSchedule,
      image: cover,
      images: savedImages,
      variations: resolvedVariations,
      sizes: savedMealSizes
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
  // VOUCHERS (Vouchers tab) — auto-distributed to all customers
  // ==========================================

  isVoucherModalOpen: boolean = false;
  editingVoucherId: string | null = null;
  vCode: string = '';
  vHeadline: string = '';
  vTitle: string = '';
  vDescription: string = '';
  vCategory: 'shipping' | 'discount' | 'cashback' = 'discount';
  vDiscountType: 'freeship' | 'fixed' | 'percent' = 'fixed';
  vDiscountValue: number | null = 50;
  vMinSpend: number | null = 0;
  vExpiry: string = 'Valid until Dec 31, 2026';
  vTag: string = 'HOT DEAL';

  openVoucherModal(voucher?: Voucher) {
    if (voucher) {
      this.editingVoucherId = voucher.id;
      this.vCode = voucher.code;
      this.vHeadline = voucher.headline;
      this.vTitle = voucher.title;
      this.vDescription = voucher.description;
      this.vCategory = voucher.category;
      this.vDiscountType = voucher.discountType;
      this.vDiscountValue = voucher.discountValue;
      this.vMinSpend = voucher.minSpend;
      this.vExpiry = voucher.expiry;
      this.vTag = voucher.tag;
    } else {
      this.editingVoucherId = null;
      this.vCode = this.suggestVoucherCode();
      this.vHeadline = '';
      this.vTitle = '';
      this.vDescription = '';
      this.vCategory = 'discount';
      this.vDiscountType = 'fixed';
      this.vDiscountValue = 50;
      this.vMinSpend = 0;
      this.vExpiry = 'Valid until Dec 31, 2026';
      this.vTag = 'HOT DEAL';
    }
    this.isVoucherModalOpen = true;
  }

  private suggestVoucherCode(): string {
    let code = '';
    do {
      code = 'VC' + Math.floor(1000 + Math.random() * 9000);
    } while (this.vouchers.some((v) => v.code.toUpperCase() === code));
    return code;
  }

  closeVoucherModal() {
    this.isVoucherModalOpen = false;
    this.editingVoucherId = null;
  }

  onVoucherCodeInput() {
    if (this.vCode) {
      this.vCode = this.vCode.toUpperCase().replace(/\s+/g, '');
    }
  }

  async saveVoucher() {
    const code = (this.vCode || '').trim().toUpperCase();
    if (!this.vTitle.trim()) {
      this.presentToast('Please enter a voucher title.', 'warning');
      return;
    }
    if (!code) {
      this.presentToast('Please enter a voucher code.', 'warning');
      return;
    }
    if (
      this.vDiscountType !== 'freeship' &&
      (!this.vDiscountValue || this.vDiscountValue <= 0)
    ) {
      this.presentToast('Please enter a discount value greater than zero.', 'warning');
      return;
    }
    if (this.vMinSpend === null || this.vMinSpend < 0) {
      this.presentToast('Minimum spend cannot be negative.', 'warning');
      return;
    }

    const duplicate = this.vouchers.some(
      (v) => v.code.toUpperCase() === code && v.id !== this.editingVoucherId
    );
    if (duplicate) {
      this.presentToast(`Code "${code}" is already used by another voucher.`, 'danger');
      return;
    }

    const headline =
      this.vHeadline.trim() ||
      (this.vDiscountType === 'freeship'
        ? 'FREE SHIPPING'
        : this.vDiscountType === 'percent'
        ? `${this.vDiscountValue}% OFF`
        : `₱${this.vDiscountValue} OFF`);

    const voucher: Voucher = {
      id: this.editingVoucherId || 'vc_' + Date.now(),
      code,
      headline,
      title: this.vTitle.trim(),
      description: this.vDescription.trim() || 'Applied automatically at checkout when eligible.',
      category: this.vCategory,
      discountType: this.vDiscountType,
      discountValue: this.vDiscountType === 'freeship' ? 0 : Number(this.vDiscountValue) || 0,
      minSpend: Number(this.vMinSpend) || 0,
      expiry: this.vExpiry.trim() || 'No expiry',
      tag: this.vTag.trim() || 'PROMO',
      usedBy: this.editingVoucherId
        ? this.vouchers.find((v) => v.id === this.editingVoucherId)?.usedBy || []
        : []
    };

    if (this.editingVoucherId) {
      this.voucherService.updateVoucher(voucher);
      this.presentToast(`Voucher "${voucher.code}" updated! Customers see it instantly.`, 'success');
    } else {
      this.voucherService.addVoucher(voucher);
      this.presentToast(`Voucher "${voucher.code}" created — now available to all customers!`, 'success');
    }
    this.closeVoucherModal();
  }

  async deleteVoucherConfirm(voucher: Voucher) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Voucher',
      message: `Remove voucher "${voucher.code}"? Customers will no longer see it.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.voucherService.deleteVoucher(voucher.id);
            this.presentToast(`Voucher "${voucher.code}" removed.`, 'dark');
          }
        }
      ]
    });
    await alert.present();
  }

  voucherUsesLabel(voucher: Voucher): string {
    const uses = voucher.usedBy.length;
    return uses === 0 ? 'Not used yet' : `Used ${uses} time${uses === 1 ? '' : 's'}`;
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
    const file: File = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const rawDataUrl = e?.target?.result;
      if (!rawDataUrl) return;

      const img = new Image();
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
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const resultUrl = ctx ? canvas.toDataURL('image/jpeg', 0.9) : rawDataUrl;

        this.ngZone.run(() => {
          this.qrImage = resultUrl;
          this.cdr.detectChanges();
        });
      };
      img.onerror = () => {
        this.ngZone.run(() => {
          this.qrImage = rawDataUrl;
          this.cdr.detectChanges();
        });
      };
      img.src = rawDataUrl;
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