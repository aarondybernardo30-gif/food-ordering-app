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
import { logInOutline, personAddOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
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
export class RegisterPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  authMode: 'signup' | 'login' = 'signup';

  registerForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10,12}$/)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loginPhone: string = '';
  loginPassword: string = '';

  constructor() {
    addIcons({ logInOutline, personAddOutline });
  }

  async onSignUp() {
    if (this.registerForm.valid) {
      const success = this.authService.register(this.registerForm.value);

      if (success) {
        const toast = await this.toastCtrl.create({
          message: 'Account created! Please sign in with your phone & password.',
          duration: 2500,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        this.loginPhone = this.registerForm.value.phone;
        this.loginPassword = '';
        this.authMode = 'login';
        this.registerForm.reset();
      } else {
        const toast = await this.toastCtrl.create({
          message: 'This phone number is already registered. Please sign in.',
          duration: 2000,
          color: 'warning',
          position: 'top'
        });
        await toast.present();
        this.authMode = 'login';
      }
    }
  }

  async onUserLogin() {
    if (!this.loginPhone.trim() || !this.loginPassword.trim()) {
      const toast = await this.toastCtrl.create({
        message: 'Please enter both phone number and password.',
        duration: 1500,
        color: 'danger',
        position: 'top'
      });
      return toast.present();
    }

    const success = this.authService.userLogin(this.loginPhone, this.loginPassword);

    if (success) {
      const toast = await this.toastCtrl.create({
        message: 'Welcome to ShopeeFood!',
        duration: 1500,
        color: 'success',
        position: 'top'
      });
      await toast.present();

      this.router.navigate(['/menu']);
    } else {
      const toast = await this.toastCtrl.create({
        message: 'Invalid phone number or password. Please try again.',
        duration: 2000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }
}