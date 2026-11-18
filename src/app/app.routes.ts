import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';
import { riderGuard } from './guards/rider-guard';
import { APP_MODE } from './app.mode';

const mode = APP_MODE as string;
const DEFAULT_ROUTE =
  mode === 'rider' ? 'rider' : mode === 'admin' ? 'admin' : 'menu';

export const routes: Routes = [
  {
    path: '',
    redirectTo: DEFAULT_ROUTE,
    pathMatch: 'full'
  },
  {
    path: 'home',
    redirectTo: DEFAULT_ROUTE,
    pathMatch: 'full'
  },

  // ----- Customer authentication (combined Login / Sign Up page) -----
  {
    path: 'login',
    redirectTo: 'register',
    pathMatch: 'full'
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage)
  },

  // ----- Customer pages (sign-in required) -----
  {
    path: 'menu',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/menu/menu.page').then((m) => m.MenuPage)
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/notifications/notifications.page').then((m) => m.NotificationsPage)
  },
  {
    path: 'me',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/me/me.page').then((m) => m.MePage)
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cart/cart.page').then((m) => m.CartPage)
  },
  {
    path: 'place-order',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/place-order/place-order.page').then((m) => m.PlaceOrderPage)
  },

  // ----- Admin portal -----
  {
    path: 'admin-auth',
    loadComponent: () => import('./pages/admin-auth/admin-auth.page').then((m) => m.AdminAuthPage)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage)
  },
  {
    path: 'admin-reports',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin-reports/admin-reports.page').then((m) => m.AdminReportsPage)
  },
  {
    path: 'add-food',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/add-food/add-food.page').then((m) => m.AddFoodPage)
  },

  // ----- Rider portal -----
  {
    path: 'rider-auth',
    loadComponent: () => import('./pages/rider-auth/rider-auth.page').then((m) => m.RiderAuthPage)
  },
  {
    path: 'rider',
    canActivate: [riderGuard],
    loadComponent: () => import('./pages/rider/rider.page').then((m) => m.RiderPage)
  },

  {
    path: '**',
    redirectTo: DEFAULT_ROUTE
  }
];