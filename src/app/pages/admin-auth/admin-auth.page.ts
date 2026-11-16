import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonContent, 
  IonItem, 
  IonInput, 
  IonButton, 
  IonSegment, 
  IonSegmentButton, 
  IonLabel, 
  IonIcon, 
  IonCard, 
  IonCardContent, 
  ToastController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logInOutline, personAddOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-auth',
  templateUrl: './admin-auth.page.html',
  styleUrls: ['./admin-auth.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    IonHeader, 
    IonToolbar, 
    IonContent, 
    IonItem, 
    IonInput, 
    IonButton, 
    IonSegment, 
    IonSegmentButton, 
    IonLabel, 
    IonIcon, 
    IonCard, 
    IonCardContent
  ]
})
export class AdminAuthPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  authMode: 'signup' | 'login' = 'signup';

  adminRegisterForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loginUsername: string = '';
  loginPassword: string = '';

  constructor() {
    addIcons({ logInOutline, personAddOutline, shieldCheckmarkOutline });
  }

  async onAdminSignUp() {
    if (this.adminRegisterForm.valid) {
      const success = this.authService.registerAdmin(this.adminRegisterForm.value);

      if (success) {
        const toast = await this.toastCtrl.create({
          message: 'Admin account created successfully! Please sign in.',
          duration: 2500,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        this.loginUsername = this.adminRegisterForm.value.username;
        this.loginPassword = '';
        this.authMode = 'login';
        this.adminRegisterForm.reset();
      } else {
        const toast = await this.toastCtrl.create({
          message: 'Username already taken. Please choose another username.',
          duration: 2000,
          color: 'warning',
          position: 'top'
        });
        await toast.present();
      }
    }
  }

  async onAdminLogin() {
    if (!this.loginUsername.trim() || !this.loginPassword.trim()) {
      const toast = await this.toastCtrl.create({
        message: 'Please enter both Username and Password.',
        duration: 1500,
        color: 'danger',
        position: 'top'
      });
      return toast.present();
    }

    const success = this.authService.adminLogin(this.loginUsername, this.loginPassword);

    if (success) {
      const toast = await this.toastCtrl.create({
        message: 'Welcome to Admin Dashboard!',
        duration: 1500,
        color: 'success',
        position: 'top'
      });
      await toast.present();

      this.router.navigate(['/admin']);
    } else {
      const toast = await this.toastCtrl.create({
        message: 'Invalid credentials! (Default master: admin / admin123)',
        duration: 2500,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }
}