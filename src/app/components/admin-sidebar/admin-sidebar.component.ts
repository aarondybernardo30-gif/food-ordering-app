import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  shieldCheckmarkOutline,
  receiptOutline,
  fastFoodOutline,
  restaurantOutline,
  qrCodeOutline,
  locationOutline,
  statsChartOutline,
  bicycleOutline,
  logOutOutline,
  ticketOutline
} from 'ionicons/icons';

export type AdminTabKey = 'orders' | 'menu' | 'featured' | 'walletqr' | 'storelocation' | 'vouchers';
export type AdminNavDest = 'reports' | 'rider';

/**
 * Shared burger-drawer sidebar for the Admin panel.
 * Used by the dashboard page (/admin) and the Reports page (/admin-reports)
 * so both share the same navigation. The parent handles where each
 * selection leads; the component owns only its open/close state.
 */
@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.scss'],
  standalone: true,
  imports: [IonIcon]
})
export class AdminSidebarComponent {
  /** Key of the currently active section ('' for none). */
  @Input() active: string = '';

  /** Fired when a dashboard tab is chosen (handled by the parent page). */
  @Output() tabSelect = new EventEmitter<AdminTabKey>();

  /** Fired for destinations that are separate pages (Reports / Rider). */
  @Output() navigate = new EventEmitter<AdminNavDest>();

  @Output() logout = new EventEmitter<void>();

  /** Signal: this app runs zoneless change detection, so drawer state
   *  mutated from a parent's event handler must be a signal for the
   *  child view (class bindings) to re-render. */
  isOpen = signal(false);

  readonly manageNav: ReadonlyArray<{
    key: AdminTabKey;
    label: string;
    icon: string;
  }> = [
    { key: 'menu', label: 'Food Menu & Pricing', icon: 'fast-food-outline' },
    { key: 'featured', label: 'Featured Meals', icon: 'restaurant-outline' },
    { key: 'walletqr', label: 'Wallet QR', icon: 'qr-code-outline' },
    { key: 'storelocation', label: 'Store GPS Location', icon: 'location-outline' },
    { key: 'vouchers', label: 'Vouchers', icon: 'ticket-outline' }
  ];

  constructor() {
    addIcons({
      shieldCheckmarkOutline,
      receiptOutline,
      fastFoodOutline,
      restaurantOutline,
      qrCodeOutline,
      locationOutline,
      statsChartOutline,
      bicycleOutline,
      logOutOutline,
      ticketOutline
    });
  }

  toggle() {
    this.isOpen.update(value => !value);
  }

  close() {
    this.isOpen.set(false);
  }

  onTabClick(key: AdminTabKey) {
    this.tabSelect.emit(key);
    this.close();
  }

  onNavigate(dest: AdminNavDest) {
    this.navigate.emit(dest);
    this.close();
  }

  onLogout() {
    this.logout.emit();
    this.close();
  }
}
