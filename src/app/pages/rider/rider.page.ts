import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButton,
  IonIcon,
  IonBadge,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonModal,
  ToastController,
  AlertController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  bicycleOutline,
  navigateOutline,
  checkmarkDoneOutline,
  locationOutline,
  personCircleOutline,
  cameraOutline,
  imageOutline,
  closeOutline,
  trashOutline
} from 'ionicons/icons';
import { Order, Rider } from '../../models/food.model';
import { OrderService } from '../../services/order';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-rider',
  templateUrl: './rider.page.html',
  styleUrls: ['./rider.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButton,
    IonIcon,
    IonBadge,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonModal
  ]
})
export class RiderPage implements OnInit {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  selectedSegment: 'active' | 'delivered' = 'active';
  currentRider: Rider | null = null;
  assignedOrders: Order[] = [];

  constructor() {
    addIcons({
      logOutOutline,
      bicycleOutline,
      navigateOutline,
      checkmarkDoneOutline,
      locationOutline,
      personCircleOutline,
      cameraOutline,
      imageOutline,
      closeOutline,
      trashOutline
    });
  }

  ngOnInit() {
    this.loadCurrentRider();
    this.loadAndFilterOrders();

    this.orderService.orders$.subscribe(allOrders => {
      this.filterMyOrders(allOrders);
    });
  }

  ionViewWillEnter() {
    this.loadCurrentRider();
    this.loadAndFilterOrders();
  }

  get activeOrders(): Order[] {
    return this.assignedOrders.filter(o => o.status !== 'Completed');
  }

  get deliveredOrders(): Order[] {
    return this.assignedOrders.filter(o => o.status === 'Completed');
  }

  private loadCurrentRider() {
    try {
      const stored = localStorage.getItem('current_rider');
      if (stored) {
        this.currentRider = JSON.parse(stored);
      } else {
        this.router.navigate(['/rider-auth']);
      }
    } catch {
      this.router.navigate(['/rider-auth']);
    }
  }

  private loadAndFilterOrders() {
    const keys = ['app_orders', 'food_orders', 'orders'];
    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const list: Order[] = Array.isArray(parsed) ? parsed : (parsed.orders || []);
          if (list.length > 0) {
            this.filterMyOrders(list);
            break;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  // Filters orders to show ONLY those assigned to this rider's phone or name
  private filterMyOrders(orders: Order[]) {
    if (!this.currentRider) return;

    const myPhone = (this.currentRider.phone || '').trim();
    const myName = (this.currentRider.fullName || '').trim().toLowerCase();
    const myUsername = (this.currentRider.username || '').trim().toLowerCase();

    this.assignedOrders = orders.filter(order => {
      const orderRiderPhone = (order.assignedRiderPhone || '').trim();
      const orderRiderName = (order.assignedRiderName || '').trim().toLowerCase();

      const phoneMatch = myPhone && orderRiderPhone && myPhone === orderRiderPhone;
      const nameMatch = myName && orderRiderName && (myName === orderRiderName || orderRiderName.includes(myName));
      const userMatch = myUsername && orderRiderName && orderRiderName === myUsername;

      return phoneMatch || nameMatch || userMatch;
    });
  }

  // --- GPS NAVIGATION ---
  openNavigation(order?: Order) {
    const targetOrder = order || this.activeOrders[0];
    if (!targetOrder) return;

    if (targetOrder.latitude && targetOrder.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${targetOrder.latitude},${targetOrder.longitude}`,
        '_blank'
      );
    } else if (targetOrder.deliveryAddress) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetOrder.deliveryAddress)}`,
        '_blank'
      );
    }
  }

  trackExactLocation(order?: Order) {
    this.openNavigation(order);
  }

  // --- PROOF OF DELIVERY ---
  proofModalOrder: Order | null = null;
  isProofModalOpen: boolean = false;
  proofImage: string = '';
  isConfirmingDelivery: boolean = false;

  // --- LIVE CAMERA (Proof of Delivery) ---
  isCameraOpen: boolean = false;
  cameraError: string = '';
  private cameraStream: MediaStream | null = null;

  /**
   * Opens a live in-app camera viewfinder (rear camera on phones).
   * Falls back to the native capture input when getUserMedia is
   * unavailable (e.g. insecure context) or permission is denied.
   */
  async openCamera() {
    this.cameraError = '';

    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        this.isCameraOpen = true;
        // Attach the stream once the video element renders
        setTimeout(() => {
          const video = document.querySelector('.camera-viewfinder video') as HTMLVideoElement | null;
          if (video && this.cameraStream) {
            video.srcObject = this.cameraStream;
            video.play().catch(() => {});
          }
        }, 80);
        return;
      } catch (e) {
        this.cameraError = 'Camera is unavailable or permission was denied.';
      }
    } else {
      this.cameraError = 'Live camera is not supported on this connection.';
    }

    // Fallback: native capture input — opens the camera directly on mobile browsers
    this.triggerFileInput();
  }

  /** Captures the current video frame as the proof photo (resized to keep storage small). */
  captureCameraPhoto() {
    const video = document.querySelector('.camera-viewfinder video') as HTMLVideoElement | null;
    if (!video || !video.videoWidth) return;

    const MAX_SIZE = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > height && width > MAX_SIZE) {
      height *= MAX_SIZE / width;
      width = MAX_SIZE;
    } else if (height >= width && height > MAX_SIZE) {
      width *= MAX_SIZE / height;
      height = MAX_SIZE;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
    this.proofImage = canvas.toDataURL('image/jpeg', 0.7);

    this.stopCamera();
    this.isCameraOpen = false;
  }

  cancelCamera() {
    this.stopCamera();
    this.isCameraOpen = false;
  }

  /** Opens the hidden capture input (native camera on mobile / file picker on desktop). */
  triggerFileInput() {
    const input = document.querySelector('.proof-hidden-file-input') as HTMLInputElement | null;
    if (input) input.click();
  }

  private stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
  }

  /** Opens the Proof of Delivery sheet for the given order. */
  async setDelivered(order?: Order) {
    const targetOrder = order || this.activeOrders[0];
    if (!targetOrder) return;

    this.proofModalOrder = targetOrder;
    this.proofImage = '';
    this.isProofModalOpen = true;
  }

  completeDelivery(order?: Order) {
    this.setDelivered(order);
  }

  markDelivered(order?: Order) {
    this.setDelivered(order);
  }

  closeProofModal() {
    this.isProofModalOpen = false;
    this.proofModalOrder = null;
    this.proofImage = '';
    this.isConfirmingDelivery = false;
    this.isCameraOpen = false;
    this.cameraError = '';
    this.stopCamera();
  }

  /** Photo chosen via camera capture or file upload — resized to keep storage small. */
  onProofSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const MAX_SIZE = 640;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height >= width && height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        this.proofImage = canvas.toDataURL('image/jpeg', 0.7);
      };
    };
    reader.readAsDataURL(file);
    // Allow choosing the same file again later
    event.target.value = '';
  }

  removeProofImage() {
    this.proofImage = '';
  }

  /** Attaches the proof photo, marks the order Completed, and syncs the legacy storage keys. */
  async confirmDeliveryWithProof() {
    if (!this.proofModalOrder || !this.proofImage || this.isConfirmingDelivery) return;

    const targetOrder = this.proofModalOrder;
    this.isConfirmingDelivery = true;

    try {
      await this.orderService.submitDeliveryProof(targetOrder.id, this.proofImage);

      // Mirror into the legacy storage keys so older views pick it up too
      const keys = ['app_orders', 'food_orders', 'orders'];
      for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const list: Order[] = Array.isArray(parsed) ? parsed : (parsed.orders || []);
            const idx = list.findIndex(o => o.id === targetOrder.id);
            if (idx !== -1) {
              list[idx].status = 'Completed';
              list[idx].deliveryProof = this.proofImage;
              list[idx].deliveredAt = new Date();
              localStorage.setItem(key, JSON.stringify(list));
            }
          } catch (e) {}
        }
      }

      targetOrder.status = 'Completed';
      targetOrder.deliveryProof = this.proofImage;

      const toast = await this.toastCtrl.create({
        message: `Order #${targetOrder.id} delivered — proof of delivery saved! Great job!`,
        duration: 2500,
        color: 'success',
        position: 'top'
      });
      await toast.present();

      this.closeProofModal();
    } catch (e: any) {
      this.isConfirmingDelivery = false;
      const toast = await this.toastCtrl.create({
        message: `Could not save the proof of delivery: ${e?.message || e}`,
        duration: 2500,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

  /** Full-screen view of a saved proof photo from the Delivered tab. */
  viewProofUrl: string | null = null;
  isViewProofOpen: boolean = false;

  viewProof(order: Order) {
    if (!order.deliveryProof) return;
    this.viewProofUrl = order.deliveryProof;
    this.isViewProofOpen = true;
  }

  closeViewProof() {
    this.isViewProofOpen = false;
    this.viewProofUrl = null;
  }

  // --- LOGOUT ---
  async onRiderLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Rider Sign Out',
      message: 'Are you sure you want to log out of your rider account?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign Out',
          role: 'destructive',
          handler: () => {
            this.authService.riderLogout();
            this.router.navigate(['/rider-auth']);
          }
        }
      ]
    });
    await alert.present();
  }

  logoutRider() {
    this.onRiderLogout();
  }
}