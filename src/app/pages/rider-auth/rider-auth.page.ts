import { Component, OnInit, inject } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonCard,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonLabel,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personAddOutline,
  logInOutline,
  personOutline,
  carSportOutline,
  lockClosedOutline
} from 'ionicons/icons';
import { Rider } from '../../models/food.model';
import { AuthService } from '../../services/auth';
import { CloudSyncService } from '../../services/cloud-sync';

@Component({
  selector: 'app-rider-auth',
  templateUrl: './rider-auth.page.html',
  styleUrls: ['./rider-auth.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonCard,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonIcon,
    IonLabel,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton
]
})
export class RiderAuthPage implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private authService = inject(AuthService);
  /** Pushes rider registrations to the cloud so the Admin panel's rider list stays in sync. */
  private cloudSync = inject(CloudSyncService);

  authMode: 'signup' | 'login' = 'login';

  // Login Form Models
  loginUsername: string = '';
  loginPassword: string = '';

  // Sign Up Reactive Form
  riderRegisterForm!: FormGroup;

  constructor() {
    addIcons({
      personAddOutline,
      logInOutline,
      personOutline,
      carSportOutline,
      lockClosedOutline
    });
  }

  ngOnInit() {
    this.initForm();
  }

  private initForm() {
    this.riderRegisterForm = this.fb.group({
      // Personal information
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      age: [null as number | null, [Validators.required, Validators.min(18), Validators.max(75)]],
      email: ['', [Validators.email]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      phone: ['', [Validators.required, Validators.pattern(/^09\d{9}$/)]],
      // Vehicle information
      vehicleType: ['', [Validators.required]],
      plateNumber: [''],
      licenseNumber: [''],
      // Account credentials
      username: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  /** True when a control fails validation and the user interacted with it (for red borders). */
  isInvalid(name: string): boolean {
    const c = this.riderRegisterForm?.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  // Safely get stored riders, filtering out any nulls or invalid entries
  private getStoredRiders(): Rider[] {
    try {
      const raw = localStorage.getItem('registered_riders');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(r => r && typeof r === 'object');
    } catch (e) {
      console.warn('Resetting corrupted registered_riders', e);
      localStorage.setItem('registered_riders', '[]');
      return [];
    }
  }

  // Safely get stored customer users
  private getStoredUsers(): any[] {
    try {
      const raw = localStorage.getItem('registered_users');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(u => u && typeof u === 'object');
    } catch {
      return [];
    }
  }

  // --- 1. RIDER SIGN UP ---
  async onRiderSignUp() {
    try {
      if (!this.riderRegisterForm) {
        this.initForm();
      }

      if (this.riderRegisterForm.invalid) {
        this.riderRegisterForm.markAllAsTouched();
        const controls = this.riderRegisterForm.controls;
        if (controls['fullName']?.invalid) {
          await this.presentToast('Please enter your full name.', 'warning');
          return;
        }
        if (controls['age']?.invalid) {
          await this.presentToast('Age must be a number between 18 and 75.', 'warning');
          return;
        }
        if (controls['email']?.invalid) {
          await this.presentToast('Please enter a valid email address.', 'warning');
          return;
        }
        if (controls['address']?.invalid) {
          await this.presentToast('Please enter your complete address.', 'warning');
          return;
        }
        if (controls['phone']?.invalid) {
          await this.presentToast('Please enter a valid 11-digit mobile number (09XXXXXXXXX).', 'warning');
          return;
        }
        if (controls['vehicleType']?.invalid) {
          await this.presentToast('Please select your vehicle type.', 'warning');
          return;
        }
        if (controls['username']?.invalid) {
          await this.presentToast('Please enter a username (at least 2 characters).', 'warning');
          return;
        }
        if (controls['password']?.invalid) {
          await this.presentToast('Password must be at least 4 characters.', 'warning');
          return;
        }
        await this.presentToast('Please fill out all required fields.', 'warning');
        return;
      }

      const formVal = this.riderRegisterForm.value || {};
      const fullName = (formVal.fullName || '').trim();
      const username = (formVal.username || '').trim().toLowerCase();
      const phone = (formVal.phone || '').trim();
      const password = (formVal.password || '').trim();
      const age = formVal.age != null && formVal.age !== '' ? Number(formVal.age) : undefined;
      const email = (formVal.email || '').trim();
      const address = (formVal.address || '').trim();
      const vehicleType = (formVal.vehicleType || '').trim();
      const plateNumber = (formVal.plateNumber || '').trim();
      const licenseNumber = (formVal.licenseNumber || '').trim();

      const riders = this.getStoredRiders();

      // Check duplicates safely with optional chaining
      const usernameTaken = riders.some(r => (r?.username || '').toLowerCase() === username);
      if (usernameTaken) {
        await this.presentToast('Rider username is already taken. Choose another.', 'danger');
        return;
      }

      const phoneTaken = riders.some(r => (r?.phone || '').trim() === phone);
      if (phoneTaken) {
        await this.presentToast('A rider with this phone number already exists.', 'danger');
        return;
      }

      const newRider: Rider = {
        id: 'rider_' + Date.now(),
        fullName,
        username,
        phone,
        password,
        age,
        email: email || undefined,
        address: address || undefined,
        vehicleType,
        plateNumber: plateNumber || undefined,
        licenseNumber: licenseNumber || undefined
      };

      riders.push(newRider);
      localStorage.setItem('registered_riders', JSON.stringify(riders));
      // Sync to the cloud so the Admin rider-selection list includes this rider everywhere
      this.cloudSync.pushKey('registered_riders', riders);
      this.saveRiderSession(newRider);

      await this.presentToast(`Account created! Welcome, ${newRider.fullName}!`, 'success');
      this.riderRegisterForm.reset();

      // Safe navigation with fallback
      this.navigateToRiderHub();
    } catch (err: any) {
      console.error('Sign up error:', err);
      await this.presentToast(`Sign Up Error: ${err?.message || err}`, 'danger');
    }
  }

  // --- 2. RIDER SIGN IN ---
  async onRiderLogin() {
    try {
      const userKey = (this.loginUsername || '').trim().toLowerCase();
      const pass = (this.loginPassword || '').trim();

      if (!userKey || !pass) {
        await this.presentToast('Please enter your username/phone and password.', 'warning');
        return;
      }

      const riders = this.getStoredRiders();

      // 1. Search in registered_riders safely
      let rider = riders.find(r => {
        if (!r) return false;
        const u = (r.username || '').toLowerCase();
        const p = (r.phone || '').trim();
        const f = (r.fullName || '').toLowerCase();
        return (u === userKey || p === userKey || f === userKey) && r.password === pass;
      });

      // 2. If not found in riders, check customer accounts (auto-promote customer to rider)
      if (!rider) {
        const users = this.getStoredUsers();
        const matchedUser = users.find(u => {
          if (!u) return false;
          const uName = (u.username || '').toLowerCase();
          const fName = (u.fullName || '').toLowerCase();
          const uPhone = (u.phone || '').trim();
          return (uName === userKey || fName === userKey || uPhone === userKey) && u.password === pass;
        });

        if (matchedUser) {
          rider = {
            id: 'rider_' + Date.now(),
            fullName: matchedUser.fullName || userKey,
            username: matchedUser.username || userKey,
            phone: matchedUser.phone || '09000000000',
            password: matchedUser.password
          };
          riders.push(rider);
          localStorage.setItem('registered_riders', JSON.stringify(riders));
          // Keep the cloud rider list in sync for the Admin panel too
          this.cloudSync.pushKey('registered_riders', riders);
        }
      }

      if (rider) {
        this.saveRiderSession(rider);
        await this.presentToast(`Welcome, ${rider.fullName}!`, 'success');
        this.loginUsername = '';
        this.loginPassword = '';

        // Safe navigation with fallback
        this.navigateToRiderHub();
      } else {
        await this.presentToast('Incorrect username or password.', 'danger');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      await this.presentToast(`Login Error: ${err?.message || err}`, 'danger');
    }
  }

  private saveRiderSession(rider: Rider) {
    try {
      localStorage.setItem('current_rider', JSON.stringify(rider));
      localStorage.setItem('is_rider_logged_in', 'true');
      localStorage.setItem('rider_logged_in', 'true');

      if (this.authService && typeof (this.authService as any).riderLogin === 'function') {
        try {
          (this.authService as any).riderLogin(rider);
        } catch (e) {
          console.warn('AuthService hook warning:', e);
        }
      }
    } catch (e) {
      console.error('Session save warning:', e);
    }
  }

  private navigateToRiderHub() {
    this.router.navigate(['/rider']).catch(() => {
      // Direct fallback if router is blocked
      window.location.href = '/rider';
    });
  }

  private async presentToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}