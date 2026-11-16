import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonButton,
  IonIcon,
  IonModal,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  imageOutline,
  trashOutline,
  addCircleOutline,
  checkmarkCircleOutline,
  arrowBackOutline,
  imagesOutline,
  pencilOutline,
  closeOutline
} from 'ionicons/icons';
import { FoodItem, FoodVariation } from '../../models/food.model';
import { FoodService } from '../../services/food';

@Component({
  selector: 'app-add-food',
  templateUrl: './add-food.page.html',
  styleUrls: ['./add-food.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
    IonIcon,
    IonModal
  ]
})
export class AddFoodPage {
  private foodService = inject(FoodService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  newFoodName: string = '';
  newFoodCategory: string = 'Chicken';
  newFoodPrice: number | null = null;
  newFoodDesc: string = '';
  newFoodDiscount: string = '';

  variationList: FoodVariation[] = [
    { name: 'Regular', price: 100 }
  ];

  isVariationFormOpen: boolean = false;
  isEditingVariation: boolean = false;
  editingIndex: number = -1;
  modalVarName: string = '';
  modalVarPrice: number | null = null;

  uploadedImages: string[] = [];

  constructor() {
    addIcons({
      cameraOutline,
      imageOutline,
      trashOutline,
      addCircleOutline,
      checkmarkCircleOutline,
      arrowBackOutline,
      imagesOutline,
      pencilOutline,
      closeOutline
    });
  }

  onBasePriceChange() {
    if (this.newFoodPrice && this.newFoodPrice > 0 && this.variationList.length > 0) {
      const reg = this.variationList.find(v => v.name.toLowerCase() === 'regular');
      if (reg) {
        reg.price = Number(this.newFoodPrice);
      }
    }
  }

  openAddVariation() {
    this.isEditingVariation = false;
    this.editingIndex = -1;
    this.modalVarName = '';
    this.modalVarPrice = this.newFoodPrice ? Number(this.newFoodPrice) : 100;
    this.isVariationFormOpen = true;
  }

  openEditVariation(index: number) {
    if (index >= 0 && index < this.variationList.length) {
      this.isEditingVariation = true;
      this.editingIndex = index;
      this.modalVarName = this.variationList[index].name.replace(/[()]/g, '').trim();
      this.modalVarPrice = this.variationList[index].price ?? null;
      this.isVariationFormOpen = true;
    }
  }

  closeVariationForm() {
    this.isVariationFormOpen = false;
    this.modalVarName = '';
    this.modalVarPrice = null;
    this.editingIndex = -1;
  }

  saveVariationFromForm() {
    // Strip any parenthesis characters
    const name = this.modalVarName.replace(/[()]/g, '').trim();
    if (!name) {
      this.presentToast('Please enter a variation name.', 'warning');
      return;
    }

    if (this.modalVarPrice === null || this.modalVarPrice < 0) {
      this.presentToast('Please enter a valid price.', 'warning');
      return;
    }

    const price = Number(this.modalVarPrice);

    if (this.isEditingVariation && this.editingIndex >= 0) {
      this.variationList[this.editingIndex] = { name, price };
      this.presentToast(`Updated "${name}" to ₱${price.toFixed(2)}`, 'success');
    } else {
      const exists = this.variationList.some(v => v.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        this.presentToast(`"${name}" already exists. Edit its price instead.`, 'warning');
        return;
      }
      this.variationList.push({ name, price });
      this.presentToast(`Added "${name}" ₱${price.toFixed(2)}`, 'success');
    }

    this.closeVariationForm();
  }

  removeVariation(index: number) {
    if (this.variationList.length <= 1) {
      this.presentToast('At least one variation choice must remain.', 'warning');
      return;
    }
    const removed = this.variationList[index];
    this.variationList.splice(index, 1);
    this.presentToast(`Removed "${removed.name}"`, 'dark');
  }

  onImagesSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && files.length > 0) {
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
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            this.uploadedImages.push(compressed);
          };
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removePhoto(index: number) {
    this.uploadedImages.splice(index, 1);
  }

  async saveNewFood() {
    if (!this.newFoodName.trim()) {
      this.presentToast('Please enter a food name.', 'warning');
      return;
    }

    if (this.newFoodPrice === null || this.newFoodPrice <= 0) {
      this.presentToast('Please enter a valid base price.', 'warning');
      return;
    }

    if (this.uploadedImages.length === 0) {
      this.presentToast('Please upload at least one photo.', 'warning');
      return;
    }

    const basePrice = Number(this.newFoodPrice);
    const resolvedVariations: FoodVariation[] = this.variationList.length > 0
      ? this.variationList
      : [{ name: 'Regular', price: basePrice }];

    // Saved with numbers only - NO PARENTHESES!
    const formattedOptions: string[] = resolvedVariations.map(v => {
      const cleanName = v.name.replace(/[()]/g, '').trim();
     return `${cleanName} P${(v.price || 0).toFixed(0)}`;
    });

    const newFood: FoodItem = {
      id: Date.now(),
      name: this.newFoodName.trim(),
      category: this.newFoodCategory || 'Chicken',
      price: basePrice,
      description: this.newFoodDesc.trim() || 'Freshly prepared item.',
      imageUrl: this.uploadedImages[0],
      images: this.uploadedImages,
      options: formattedOptions,
      variations: resolvedVariations,
      discount: this.newFoodDiscount.trim() || undefined,
      rating: 5.0,
      available: true,
      soldCount: '0 sold'
    };

    this.foodService.addFood(newFood);

    const toast = await this.toastCtrl.create({
      message: `"${newFood.name}" added successfully!`,
      duration: 2200,
      color: 'success',
      position: 'top'
    });
    await toast.present();

    this.router.navigate(['/admin']);
  }

  private async presentToast(message: string, color: string = 'dark') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'top'
    });
    await toast.present();
  }
}