import { Component, OnInit, inject, ChangeDetectorRef, NgZone, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonModal,
  ToastController,
  LoadingController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  imagesOutline,
  imageOutline,
  cameraOutline,
  trashOutline,
  addCircleOutline,
  closeOutline,
  closeCircleOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  optionsOutline,
  fastFoodOutline,
  star
} from 'ionicons/icons';
import { FoodService } from '../../services/food';
import { FoodItem, FoodVariation } from '../../models/food.model';

@Component({
  selector: 'app-add-food',
  templateUrl: './add-food.page.html',
  styleUrls: ['./add-food.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonModal
],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AddFoodPage implements OnInit {
  private foodService = inject(FoodService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Form Fields (bound to add-food.page.html)
  newFoodName: string = '';
  newFoodCategory: string = 'Chicken';
  newFoodPrice: number | null = null;
  newFoodStock: number | null = 20;
  newFoodDesc: string = '';

  // Shared Size Dropdown Options for Variations & Custom Pricing
  readonly sizeDropdownOptions: string[] = [
    'Solo',
    'Regular',
    'Medium',
    'Large',
    'Family',
    'Sharing',
    'XL'
  ];

  // Variations & Custom Pricing (mirrors Edit Food Item modal)
  variationList: FoodVariation[] = [
    { name: 'Regular', size: 'Regular', price: 100 }
  ];
  editingVarIndex: number = -1;
  newVarName: string = '';
  newVarSize: string = '';
  newVarPrice: number | null = null;

  get sizeDropdownOptionsList(): string[] {
    const seen = new Set<string>();
    const options: string[] = [];
    const pushUnique = (sz?: string) => {
      const clean = (sz || '').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        options.push(clean);
      }
    };
    this.sizeDropdownOptions.forEach(pushUnique);
    this.variationList.forEach(v => pushUnique(v?.size));
    return options;
  }

  // Add New Category Modal State
  isCategoryModalOpen: boolean = false;
  newCatName: string = '';
  newCatImage: string = '';

  // Images
  uploadedImages: string[] = [];
  primaryImageIndex: number = 0;

  categories: string[] = [
    'Chicken',
    'Snacks',
    'Burgers',
    'Pizza',
    'Pasta',
    'Desserts',
    'Drinks'
  ];

  constructor() {
    addIcons({
      arrowBackOutline,
      imagesOutline,
      imageOutline,
      cameraOutline,
      trashOutline,
      addCircleOutline,
      closeOutline,
      closeCircleOutline,
      checkmarkCircle,
      checkmarkCircleOutline,
      optionsOutline,
      fastFoodOutline,
      star
    });
  }

  ngOnInit() {
    this.foodService.categories$.subscribe((cats) => {
      if (Array.isArray(cats) && cats.length > 0) {
        this.categories = [...cats];
        if (!this.categories.includes(this.newFoodCategory)) {
          this.newFoodCategory = this.categories[0];
        }
      }
    });
  }

  // --- ADD NEW CATEGORY WITH IMAGE ---
  addNewCategory() {
    this.newCatName = '';
    this.newCatImage = '';
    this.isCategoryModalOpen = true;
  }

  closeCategoryModal() {
    this.isCategoryModalOpen = false;
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
          this.newCatImage = resultUrl;
          this.cdr.detectChanges();
        });
      };
      img.onerror = () => {
        this.ngZone.run(() => {
          this.newCatImage = rawDataUrl;
          this.cdr.detectChanges();
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  saveNewCategory() {
    const cat = (this.newCatName || '').trim();
    if (!cat) {
      this.showToast('Please enter a category name.', 'warning');
      return;
    }
    if (!this.newCatImage.trim()) {
      this.showToast('Please upload a category image.', 'warning');
      return;
    }

    const saved = this.foodService.addCategory(cat, this.newCatImage);
    this.newFoodCategory = saved;
    this.closeCategoryModal();
    this.showToast(`Category "${saved}" added with image!`, 'success');
  }

  onBasePriceChange() {
    const parsed = Number(this.newFoodPrice);
    if (!isNaN(parsed) && parsed > 0 && this.variationList.length === 1 && this.variationList[0].name === 'Regular') {
      this.variationList[0].price = parsed;
    }
  }

  // --- VARIATIONS & CUSTOM PRICING HANDLERS ---
  editExistingVariation(index: number) {
    const v = this.variationList[index];
    if (!v) return;
    this.editingVarIndex = index;
    this.newVarName = v.name;
    this.newVarSize = v.size || '';
    this.newVarPrice = v.price ?? this.newFoodPrice ?? 0;
  }

  cancelEditVariation() {
    this.editingVarIndex = -1;
    this.newVarName = '';
    this.newVarSize = '';
    this.newVarPrice = null;
  }

  addOrUpdateVariation() {
    const name = this.newVarName.trim().replace(/[()]/g, '');
    if (!name) {
      this.showToast('Please enter a variation choice name (e.g. Regular, Spicy).', 'warning');
      return;
    }

    const price = (this.newVarPrice !== null && this.newVarPrice >= 0)
      ? Number(this.newVarPrice)
      : (this.newFoodPrice ? Number(this.newFoodPrice) : 100);

    const size = (this.newVarSize || '').trim();
    const exists = this.variationList.some(
      (v, idx) =>
        idx !== this.editingVarIndex &&
        v.name.toLowerCase() === name.toLowerCase() &&
        (v.size || '').toLowerCase() === size.toLowerCase()
    );
    if (exists) {
      this.showToast(`"${name}${size ? ' (' + size + ')' : ''}" already exists.`, 'warning');
      return;
    }

    const nextVariation: FoodVariation = size ? { name, size, price } : { name, price };

    if (this.editingVarIndex > -1) {
      this.variationList[this.editingVarIndex] = nextVariation;
      this.editingVarIndex = -1;
      this.showToast('Variation updated!', 'success');
    } else {
      this.variationList.push(nextVariation);
    }

    this.newVarName = '';
    this.newVarSize = '';
    this.newVarPrice = null;
  }

  removeVariation(index: number) {
    if (this.variationList.length <= 1) {
      this.showToast('At least one variation choice should remain.', 'warning');
      return;
    }
    this.variationList.splice(index, 1);
    if (this.editingVarIndex === index) {
      this.cancelEditVariation();
    } else if (this.editingVarIndex > index) {
      this.editingVarIndex--;
    }
  }

  // --- MULTIPLE IMAGES HANDLING ---
  onImagesSelected(event: any) {
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
          const MAX_SIZE = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressed = ctx ? canvas.toDataURL('image/jpeg', 0.75) : rawDataUrl;
          this.ngZone.run(() => {
            if (!this.uploadedImages.includes(compressed)) {
              this.uploadedImages = [...this.uploadedImages, compressed];
              this.cdr.detectChanges();
            }
          });
        };
        img.onerror = () => {
          this.ngZone.run(() => {
            if (!this.uploadedImages.includes(rawDataUrl)) {
              this.uploadedImages = [...this.uploadedImages, rawDataUrl];
              this.cdr.detectChanges();
            }
          });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  }

  setPrimaryImage(index: number) {
    this.primaryImageIndex = index;
  }

  removePhoto(index: number, event?: Event) {
    if (event) event.stopPropagation();
    this.uploadedImages = this.uploadedImages.filter((_, i) => i !== index);
    if (this.primaryImageIndex >= this.uploadedImages.length) {
      this.primaryImageIndex = Math.max(0, this.uploadedImages.length - 1);
    }
  }

  // --- SAVE & ADD TO MENU ---
  async saveNewFood() {
    if (!this.newFoodName.trim()) {
      this.showToast('Please enter the food name.', 'warning');
      return;
    }

    const basePrice = Number(
      this.newFoodPrice ?? (this.variationList.length > 0 ? (this.variationList[0].price ?? 0) : 0)
    );
    if (isNaN(basePrice) || basePrice <= 0) {
      this.showToast('Please enter a valid base price.', 'warning');
      return;
    }

    const stockQty = Math.max(0, Math.floor(Number(this.newFoodStock ?? 20)));

    if (this.uploadedImages.length === 0) {
      this.showToast('Please upload at least one food picture.', 'warning');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Publishing to store menu...',
      spinner: 'crescent'
    });
    await loader.present();

    const mainImageUrl = this.uploadedImages[this.primaryImageIndex] || this.uploadedImages[0];

    const resolvedVariations: FoodVariation[] = this.variationList.length > 0
      ? this.variationList
      : [{ name: 'Regular', size: 'Regular', price: basePrice }];

    const formattedOptions = resolvedVariations.map((v: any) => {
      const sizePart = v.size ? ` (${v.size})` : '';
      return `${v.name}${sizePart} P${(v.price ?? 0).toFixed(0)}`;
    });

    const derivedSizes = Array.from(
      new Set(
        resolvedVariations
          .map(v => (v.size || '').trim())
          .filter(Boolean)
      )
    );
    const savedSizes = derivedSizes.length > 0 ? derivedSizes : ['Regular'];

    const newFoodItem: FoodItem = {
      id: Date.now(),
      name: this.newFoodName.trim(),
      category: this.newFoodCategory,
      price: basePrice,
      stock: stockQty,
      description: this.newFoodDesc.trim() || 'Freshly prepared delicious item.',
      rating: 5.0,
      imageUrl: mainImageUrl,
      images: this.uploadedImages,
      available: stockQty > 0,
      soldCount: 0,
      isMall: true,
      freeShipping: true,
      options: formattedOptions,
      variations: resolvedVariations,
      sizes: savedSizes,
      reviews: []
    };

    try {
      await this.foodService.addFood(newFoodItem);
      await loader.dismiss();
      await this.showToast(`"${newFoodItem.name}" added to menu!`, 'success');
      this.router.navigate(['/admin'], { replaceUrl: true });
    } catch (err) {
      await loader.dismiss();
      await this.showToast('Failed to save food item.', 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2500,
      position: 'top'
    });
    await toast.present();
  }
}