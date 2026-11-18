import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Order, Voucher } from '../models/food.model';
import { CloudSyncService } from './cloud-sync';

/**
 * Single source of truth for vouchers. Admin-created vouchers are stored
 * in `app_vouchers` (cloud-synced) and automatically become available to
 * every customer. Per-customer usage is tracked in `usedBy`, so a voucher
 * disappears from a customer's list once that customer uses it.
 */
@Injectable({
  providedIn: 'root'
})
export class VoucherService {
  private readonly STORAGE_KEY = 'app_vouchers';
  private cloudSync = inject(CloudSyncService);

  private vouchersSubject = new BehaviorSubject<Voucher[]>(this.loadFromStorage());
  public vouchers$: Observable<Voucher[]> = this.vouchersSubject.asObservable();

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            this.vouchersSubject.next(parsed);
          }
        } catch {}
      }
    });

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === this.STORAGE_KEY && Array.isArray(data)) {
        this.vouchersSubject.next(data);
      }
    });
  }

  private loadFromStorage(): Voucher[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return this.defaultSeed();
  }

  private defaultSeed(): Voucher[] {
    return [
      {
        id: 'vc_seed_1',
        code: 'FREESHIP',
        headline: 'FREE SHIPPING',
        title: 'Free Delivery Special',
        description: 'Waives 100% of standard delivery fee on orders above ₱250.',
        category: 'shipping',
        discountType: 'freeship',
        discountValue: 0,
        minSpend: 250,
        expiry: 'Valid until Dec 31, 2026',
        tag: 'HOT DEAL',
        usedBy: []
      },
      {
        id: 'vc_seed_2',
        code: 'TASTYSAVE',
        headline: '₱50 OFF',
        title: 'Lunch & Dinner Feast',
        description: 'Get an instant ₱50 deduction on all combo and family platters.',
        category: 'discount',
        discountType: 'fixed',
        discountValue: 50,
        minSpend: 300,
        expiry: 'Valid until Dec 31, 2026',
        tag: 'HOT DEAL',
        usedBy: []
      },
      {
        id: 'vc_seed_3',
        code: 'SAVE10PCT',
        headline: '10% OFF',
        title: 'Wallet Cashback Bonus',
        description: '10% off your order total when you spend ₱200 or more.',
        category: 'cashback',
        discountType: 'percent',
        discountValue: 10,
        minSpend: 200,
        expiry: 'Valid until Dec 15, 2026',
        tag: 'LIMITED VOUCHER',
        usedBy: []
      },
      {
        id: 'vc_seed_4',
        code: 'QUICKPICK',
        headline: '₱30 OFF',
        title: 'Pick-Up Express Discount',
        description: 'Save ₱30 when ordering ahead for takeaway or dine-in counter pickup.',
        category: 'discount',
        discountType: 'fixed',
        discountValue: 30,
        minSpend: 150,
        expiry: 'Valid until Dec 20, 2026',
        tag: 'PICK-UP ONLY',
        usedBy: []
      },
      {
        id: 'vc_seed_5',
        code: 'SUPERZERO',
        headline: 'FREE DELIV',
        title: 'No Min. Spend Delivery',
        description: 'Enjoy free delivery for breakfast snacks and beverages.',
        category: 'shipping',
        discountType: 'freeship',
        discountValue: 0,
        minSpend: 0,
        expiry: 'Valid until Dec 31, 2026',
        tag: 'SPECIAL PROMO',
        usedBy: []
      }
    ];
  }

  private saveToStorage(vouchers: Voucher[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vouchers));
    this.vouchersSubject.next(vouchers);
    this.cloudSync.pushKey(this.STORAGE_KEY, vouchers);
  }

  getVouchers(): Voucher[] {
    return this.vouchersSubject.value;
  }

  /** Vouchers the given customer can still use (unused by them). */
  availableFor(customerKey: string): Voucher[] {
    const key = (customerKey || '').toLowerCase();
    return this.getVouchers().filter(
      (v) => !v.usedBy.some((u) => u.toLowerCase() === key)
    );
  }

  isShippingVoucher(voucher: Voucher | null | undefined): boolean {
    if (!voucher) return false;
    const category = (voucher.category || '').toLowerCase();
    const code = (voucher.code || '').toUpperCase();
    const headline = (voucher.headline || '').toUpperCase();
    const title = (voucher.title || '').toUpperCase();

    return (
      voucher.discountType === 'freeship' ||
      category === 'shipping' ||
      code.includes('FREESHIP') ||
      code.includes('SHIP') ||
      headline.includes('FREE SHIPPING') ||
      headline.includes('FREE DELIV') ||
      title.includes('FREE DELIVERY')
    );
  }

  isPickupOrDineInOnly(voucher: Voucher | null | undefined): boolean {
    if (!voucher) return false;
    const tag = (voucher.tag || '').toUpperCase();
    const code = (voucher.code || '').toUpperCase();
    const title = (voucher.title || '').toUpperCase();
    const desc = (voucher.description || '').toUpperCase();

    return (
      tag.includes('PICK-UP') ||
      tag.includes('PICKUP') ||
      code === 'QUICKPICK' ||
      title.includes('PICK-UP') ||
      desc.includes('TAKEAWAY OR DINE-IN')
    );
  }

  isExpired(voucher: Voucher | null | undefined): boolean {
    if (!voucher?.expiry) return false;
    const match = voucher.expiry.match(/([A-Za-z]+\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})/);
    if (!match) return false;
    const parsed = new Date(match[1]);
    if (isNaN(parsed.getTime())) return false;
    parsed.setHours(23, 59, 59, 999);
    return parsed.getTime() < Date.now();
  }

  /** Returns null if the voucher is applicable to the order, or a short reason if not. */
  getInapplicableReason(
    voucher: Voucher | null | undefined,
    subtotal: number,
    orderType: Order['orderType']
  ): string | null {
    if (!voucher) return 'No voucher selected.';
    if (this.isExpired(voucher)) {
      return `Voucher "${voucher.code}" has expired.`;
    }
    if (this.isShippingVoucher(voucher) && orderType !== 'delivery') {
      return `Voucher "${voucher.code}" is valid for Delivery orders only.`;
    }
    if (this.isPickupOrDineInOnly(voucher) && orderType === 'delivery') {
      return `Voucher "${voucher.code}" is valid for Pick-Up or Dine-In orders only.`;
    }
    const minSpend = Number(voucher.minSpend) || 0;
    if (subtotal < minSpend) {
      return `Voucher "${voucher.code}" requires a minimum spend of ₱${minSpend}.`;
    }
    return null;
  }

  isVoucherApplicable(
    voucher: Voucher | null | undefined,
    subtotal: number,
    orderType: Order['orderType']
  ): boolean {
    return this.getInapplicableReason(voucher, subtotal, orderType) === null;
  }

  findByCode(code: string): Voucher | undefined {
    const c = (code || '').trim().toUpperCase();
    return this.getVouchers().find((v) => v.code.toUpperCase() === c);
  }

  addVoucher(voucher: Voucher) {
    this.saveToStorage([...this.getVouchers(), voucher]);
  }

  updateVoucher(voucher: Voucher) {
    this.saveToStorage(
      this.getVouchers().map((v) => (v.id === voucher.id ? voucher : v))
    );
  }

  deleteVoucher(id: string) {
    this.saveToStorage(this.getVouchers().filter((v) => v.id !== id));
  }

  /** Records that this customer used the voucher (so it disappears for them). */
  markUsed(id: string, customerKey: string) {
    const key = (customerKey || '').trim().toLowerCase();
    if (!key) return;
    const vouchers = this.getVouchers().map((v) => {
      if (v.id !== id) return v;
      if (!v.usedBy.some((u) => u.toLowerCase() === key)) {
        return { ...v, usedBy: [...v.usedBy, key] };
      }
      return v;
    });
    this.saveToStorage(vouchers);
  }
}