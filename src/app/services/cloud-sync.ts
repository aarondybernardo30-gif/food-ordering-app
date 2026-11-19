import { Injectable, NgZone, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Subject } from 'rxjs';

const SUPABASE_URL = 'https://lexlpygvyxxtbeshlhyc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_b0kAlxUPIWQfsZnsr2CUHA_hO6P6p7c';

/**
 * The old app stored every order as one "app_orders" value. That allowed
 * one customer's upload to replace another customer's orders.
 * New code stores each order under its own key in the EXISTING app_sync table.
 *
 * Note: This fixes the data-sync collision, NOT authorization. See notes.
 */
const ORDER_KEY_PREFIX = 'app-order:';
const ORDER_PAGE_SIZE = 500;
const FEATURED_MEAL_KEY_PREFIX = 'app-featured-meal:';
const FEATURED_MEAL_PAGE_SIZE = 500;
const CLOUD_POLL_INTERVAL_MS = 5000;

interface SyncedOrder {
  id: string | number;
  createdAt?: string | Date;
  [key: string]: any;
}

/** Featured meals can include admin-defined variations and sizes. */
interface SyncedFeaturedMeal {
  id: string | number;
  name?: string;
  title?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  image?: string;
  images?: string[];
  variations?: any[];
  sizes?: string[];
  [key: string]: any;
}

/** Values from the admin Add Featured Meal form. */
export interface FeaturedMealInput {
  mealName: string;
  mealPrice: number | string;
  mealOriginalPrice?: number | string;
  mealStock?: number | string;
  mealImage?: string;
  variationInput?: string;
  sizeInput?: string;
}

export const SYNC_KEYS = [
  'app_foods',
  'app_orders',
  'app_featured_meals',
  'app_promos',
  'app_topup_requests',
  'app_vouchers',
  'app_wallet_qr',
  'registered_users',
  'registered_admins',
  'registered_riders',
  'wallet_balance',
  'wallet_coins',
  'store_location',
  'admin_gcash_info',
  'app_categories',
  'app_category_items'
] as const;

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private readonly ngZone = inject(NgZone);
  private readonly supabase: SupabaseClient;
  private readonly changesSubject = new Subject<{ key: string; data: any }>();
  public readonly changes$ = this.changesSubject.asObservable();

  private started = false;
  private readonly tabId = Math.random().toString(36).slice(2);
  private readonly lastDirectWatch: Record<string, string> = {};
  private readonly knownCloudUpdatedAt = new Map<string, string>();

  private readonly orders = new Map<string, SyncedOrder>();
  private readonly syncedOrderVersions = new Map<string, string>();
  private legacyCloudOrders: SyncedOrder[] = [];
  private readonly ordersReady: Promise<void>;
  private markOrdersReady: () => void = () => {};
  private orderWriteQueue: Promise<void> = Promise.resolve();

  private readonly featuredMeals = new Map<string, SyncedFeaturedMeal>();
  private readonly syncedFeaturedMealVersions = new Map<string, string>();
  private legacyCloudFeaturedMeals: SyncedFeaturedMeal[] = [];
  private hasCloudFeaturedMealsKey = false;
  private readonly featuredMealsReady: Promise<void>;
  private markFeaturedMealsReady: () => void = () => {};
  private featuredMealWriteQueue: Promise<void> = Promise.resolve();

  private cloudSyncInFlight: Promise<void> | null = null;
  private pollTimerId: number | null = null;

  private readonly broadcastChannel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('app_realtime_sync')
      : null;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    this.ordersReady = new Promise<void>((resolve) => {
      this.markOrdersReady = resolve;
    });

    this.featuredMealsReady = new Promise<void>((resolve) => {
      this.markFeaturedMealsReady = resolve;
    });

    void this.init();
  }

  private async init(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.listenForLocalChanges();

    try {
      await this.loadSharedKeys();
    } catch (error) {
      console.error('Failed loading shared app settings:', error);
    }

    try {
      await this.loadAllOrders();
    } catch (error) {
      console.error('Failed loading cloud orders:', error);
      this.mergeOrders(this.parseOrders(localStorage.getItem('app_orders')));
      this.publishOrders();
    } finally {
      this.markOrdersReady();
    }

    try {
      await this.loadAllFeaturedMeals();
    } catch (error) {
      console.error('Failed loading cloud featured meals:', error);
      this.mergeFeaturedMeals(this.parseFeaturedMeals(localStorage.getItem('app_featured_meals')));
      this.publishFeaturedMeals();
    } finally {
      this.markFeaturedMealsReady();
    }

    this.subscribeToRealtime();
    this.watchDirectKeys();
    this.startCloudResumeAndPollSync();
  }

  private keyOf(id: string | number): string {
    return String(id).trim();
  }

  private listenForLocalChanges(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.onmessage = ({ data: message }) => {
        if (!message || message.tabId === this.tabId || !message.key) return;

        this.ngZone.run(() => {
          if (message.key === 'app_orders') {
            this.mergeOrders(this.parseOrders(message.data));
            this.publishOrders();
          } else if (message.key === 'app_featured_meals') {
            this.replaceFeaturedMeals(this.parseFeaturedMeals(message.data));
            this.publishFeaturedMeals();
          } else if ((SYNC_KEYS as readonly string[]).includes(message.key)) {
            this.applyOtherKey(message.key, message.data, true);
          }
        });
      };
    }

    window.addEventListener('storage', (event) => {
      if (!event.key || event.newValue === null) return;
      if (!(SYNC_KEYS as readonly string[]).includes(event.key)) return;

      this.ngZone.run(() => {
        const data = this.parseValue(event.newValue!);
        if (event.key === 'app_orders') {
          this.mergeOrders(this.parseOrders(data));
          this.publishOrders();
        } else if (event.key === 'app_featured_meals') {
          this.replaceFeaturedMeals(this.parseFeaturedMeals(data));
          this.publishFeaturedMeals();
        } else {
          this.changesSubject.next({ key: event.key!, data });
        }
      });
    });
  }

  /** Load global settings; record updated_at timestamps for delta polling. */
  private async loadSharedKeys(): Promise<void> {
    const { data: rows, error } = await this.supabase
      .from('app_sync')
      .select('key, data, updated_at')
      .in('key', [...SYNC_KEYS]);

    if (error) throw error;

    const cloudKeys = new Set<string>();
    for (const row of rows || []) {
      cloudKeys.add(row.key);
      if (row.updated_at) {
        this.knownCloudUpdatedAt.set(row.key, String(row.updated_at));
      }

      if (row.key === 'app_orders') {
        this.legacyCloudOrders = this.parseOrders(row.data);
      } else if (row.key === 'app_featured_meals') {
        this.hasCloudFeaturedMealsKey = true;
        this.legacyCloudFeaturedMeals = this.parseFeaturedMeals(row.data);
      } else {
        this.ngZone.run(() => this.applyOtherKey(row.key, row.data, false));
      }
    }

    // Keep the previous PC-only migration for the other shared app keys.
    if (!Capacitor.isNativePlatform()) {
      for (const key of SYNC_KEYS) {
        if (key === 'app_orders' || key === 'app_featured_meals' || cloudKeys.has(key)) continue;
        const raw = localStorage.getItem(key);
        if (raw !== null) await this.pushKey(key, this.parseValue(raw));
      }
    }
  }

  /** Fetch individual order keys in pages to avoid the default row limit. */
  private async fetchIndividualOrders(): Promise<SyncedOrder[]> {
    const result: SyncedOrder[] = [];
    let start = 0;

    while (true) {
      const { data: rows, error } = await this.supabase
        .from('app_sync')
        .select('key, data, updated_at')
        .like('key', `${ORDER_KEY_PREFIX}%`)
        .order('key', { ascending: true })
        .range(start, start + ORDER_PAGE_SIZE - 1);

      if (error) throw error;

      for (const row of rows || []) {
        if (row.updated_at) {
          this.knownCloudUpdatedAt.set(row.key, String(row.updated_at));
        }
        const order = this.toOrder(row.data);
        if (order) result.push(order);
      }

      if (!rows || rows.length < ORDER_PAGE_SIZE) break;
      start += ORDER_PAGE_SIZE;
    }

    return result;
  }

  private async loadAllOrders(): Promise<void> {
    const localOrders = this.parseOrders(localStorage.getItem('app_orders'));
    const individualOrders = await this.fetchIndividualOrders();
    const individualIds = new Set(individualOrders.map((order) => this.keyOf(order.id)));

    // Existing cloud rows win. Missing historical orders are retained.
    this.mergeOrders(localOrders);
    this.mergeOrders(this.legacyCloudOrders);
    this.mergeOrders(individualOrders);

    for (const order of individualOrders) {
      this.syncedOrderVersions.set(this.keyOf(order.id), JSON.stringify(order));
    }

    this.publishOrders();

    // One-time migration of historical orders to individual cloud rows.
    const missing = Array.from(this.orders.values())
      .filter((order) => !individualIds.has(this.keyOf(order.id)));

    if (missing.length) {
      try {
        await this.writeOrderRows(missing, true);
        const authoritative = await this.fetchIndividualOrders();
        this.mergeOrders(authoritative);
        for (const order of authoritative) {
          this.syncedOrderVersions.set(this.keyOf(order.id), JSON.stringify(order));
        }
        this.publishOrders();
      } catch (error) {
        console.error('Could not migrate historical orders:', error);
      }
    }
  }

  /** Read individually saved featured meals, preserving variations and sizes. */
  private async fetchIndividualFeaturedMeals(): Promise<SyncedFeaturedMeal[]> {
    const result: SyncedFeaturedMeal[] = [];
    let start = 0;

    while (true) {
      const { data: rows, error } = await this.supabase
        .from('app_sync')
        .select('key, data, updated_at')
        .like('key', `${FEATURED_MEAL_KEY_PREFIX}%`)
        .order('key', { ascending: true })
        .range(start, start + FEATURED_MEAL_PAGE_SIZE - 1);

      if (error) throw error;

      for (const row of rows || []) {
        if (row.updated_at) {
          this.knownCloudUpdatedAt.set(row.key, String(row.updated_at));
        }
        const meal = this.toFeaturedMeal(row.data);
        if (meal) result.push(meal);
      }

      if (!rows || rows.length < FEATURED_MEAL_PAGE_SIZE) break;
      start += FEATURED_MEAL_PAGE_SIZE;
    }

    return result;
  }

  private async loadAllFeaturedMeals(): Promise<void> {
    const localMeals = this.parseFeaturedMeals(localStorage.getItem('app_featured_meals'));
    const individualMeals = await this.fetchIndividualFeaturedMeals();
    const individualIds = new Set(individualMeals.map((meal) => this.keyOf(meal.id)));

    if (individualMeals.length > 0) {
      // Per-meal cloud records are the authoritative source of truth.
      this.replaceFeaturedMeals(individualMeals);
      for (const meal of individualMeals) {
        this.syncedFeaturedMealVersions.set(this.keyOf(meal.id), JSON.stringify(meal));
      }
      this.publishFeaturedMeals();
      return;
    }

    if (this.hasCloudFeaturedMealsKey) {
      // Cloud explicitly has app_featured_meals (either legacy meals to migrate, or empty []).
      this.replaceFeaturedMeals(this.legacyCloudFeaturedMeals);
      this.publishFeaturedMeals();

      if (this.legacyCloudFeaturedMeals.length > 0) {
        try {
          await this.writeFeaturedMealRows(this.legacyCloudFeaturedMeals, true);
          const authoritative = await this.fetchIndividualFeaturedMeals();
          this.replaceFeaturedMeals(authoritative);
          for (const meal of authoritative) {
            this.syncedFeaturedMealVersions.set(this.keyOf(meal.id), JSON.stringify(meal));
          }
          this.publishFeaturedMeals();
        } catch (error) {
          console.error('Could not migrate old featured meals:', error);
        }
      }
      return;
    }

    // Empty cloud database: migrate localMeals once (PC only or initial seed).
    this.replaceFeaturedMeals(localMeals);
    this.publishFeaturedMeals();

    const missing = Array.from(this.featuredMeals.values()).filter(
      (meal) => !individualIds.has(this.keyOf(meal.id))
    );

    if (missing.length && !Capacitor.isNativePlatform()) {
      try {
        await this.writeFeaturedMealRows(missing, true);
        await this.upsertRawKey('app_featured_meals', missing);
        const authoritative = await this.fetchIndividualFeaturedMeals();
        this.replaceFeaturedMeals(authoritative);
        for (const meal of authoritative) {
          this.syncedFeaturedMealVersions.set(this.keyOf(meal.id), JSON.stringify(meal));
        }
        this.publishFeaturedMeals();
      } catch (error) {
        console.error('Could not migrate local featured meals:', error);
      }
    }
  }

  private subscribeToRealtime(): void {
    this.supabase
      .channel('app-sync-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_sync' },
        (payload: any) => {
          const eventType = payload.eventType;
          const record = eventType === 'DELETE' ? payload.old : payload.new;
          if (!record || !record.key) return;

          this.ngZone.run(() => {
            if (record.key.startsWith(ORDER_KEY_PREFIX)) {
              if (eventType === 'DELETE') {
                const rawId = decodeURIComponent(record.key.slice(ORDER_KEY_PREFIX.length));
                this.orders.delete(rawId);
                this.syncedOrderVersions.delete(rawId);
                this.knownCloudUpdatedAt.delete(record.key);
                this.publishOrders();
                return;
              }
              if (record.data === undefined) return;
              const order = this.toOrder(record.data);
              if (!order) return;
              const k = this.keyOf(order.id);
              this.orders.set(k, order);
              this.syncedOrderVersions.set(k, JSON.stringify(order));
              if (record.updated_at) {
                this.knownCloudUpdatedAt.set(record.key, String(record.updated_at));
              }
              this.publishOrders();
              return;
            }

            if (record.key.startsWith(FEATURED_MEAL_KEY_PREFIX)) {
              if (eventType === 'DELETE') {
                const rawId = decodeURIComponent(record.key.slice(FEATURED_MEAL_KEY_PREFIX.length));
                this.featuredMeals.delete(rawId);
                this.syncedFeaturedMealVersions.delete(rawId);
                this.knownCloudUpdatedAt.delete(record.key);
                this.publishFeaturedMeals();
                return;
              }
              if (record.data === undefined) return;
              const meal = this.toFeaturedMeal(record.data);
              if (!meal) return;
              const k = this.keyOf(meal.id);
              this.featuredMeals.set(k, meal);
              this.syncedFeaturedMealVersions.set(k, JSON.stringify(meal));
              if (record.updated_at) {
                this.knownCloudUpdatedAt.set(record.key, String(record.updated_at));
              }
              this.publishFeaturedMeals();
              return;
            }

            if (record.key === 'app_featured_meals') {
              if (eventType === 'DELETE' || record.data === undefined) return;
              if (record.updated_at) {
                this.knownCloudUpdatedAt.set(record.key, String(record.updated_at));
              }
              const parsed = this.parseFeaturedMeals(record.data);
              // Import missing items from older app versions without overwriting newer per-meal rows.
              const missing = parsed.filter(
                (meal) => !this.featuredMeals.has(this.keyOf(meal.id))
              );
              if (missing.length) {
                this.mergeFeaturedMeals(missing);
                this.publishFeaturedMeals();
              }
              return;
            }

            if (record.key === 'app_orders') {
              if (eventType === 'DELETE' || record.data === undefined) return;
              if (record.updated_at) {
                this.knownCloudUpdatedAt.set(record.key, String(record.updated_at));
              }
              const missing = this.parseOrders(record.data).filter(
                (order) => !this.orders.has(this.keyOf(order.id))
              );
              if (missing.length) {
                this.mergeOrders(missing);
                this.publishOrders();
                void this.writeOrderRows(missing, true).catch((error) => {
                  console.error('Could not import legacy orders:', error);
                });
              }
              return;
            }

            if ((SYNC_KEYS as readonly string[]).includes(record.key) && record.data !== undefined) {
              if (record.updated_at) {
                this.knownCloudUpdatedAt.set(record.key, String(record.updated_at));
              }
              this.applyOtherKey(record.key, record.data, false);
            }
          });
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          void this.syncFromCloudDelta();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Supabase Realtime status:', status);
        }
      });
  }

  /**
   * Reliable sync for Capacitor Android/iOS APKs & browsers when Realtime
   * sleeps, disconnects, or drops large base64 payloads.
   */
  private startCloudResumeAndPollSync(): void {
    const triggerDeltaSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void this.syncFromCloudDelta();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') triggerDeltaSync();
      });
    }
    window.addEventListener('focus', triggerDeltaSync);
    window.addEventListener('online', triggerDeltaSync);

    this.pollTimerId = window.setInterval(triggerDeltaSync, CLOUD_POLL_INTERVAL_MS);
  }

  /** Fetch only (key, updated_at) metadata, then pull data only for changed rows. */
  public async syncFromCloudDelta(): Promise<void> {
    if (this.cloudSyncInFlight) return this.cloudSyncInFlight;

    this.cloudSyncInFlight = (async () => {
      try {
        await this.ordersReady;
        await this.featuredMealsReady;

        const metaRows: Array<{ key: string; updated_at: string | null }> = [];
        let start = 0;
        const pageSize = 1000;

        while (true) {
          const { data: rows, error } = await this.supabase
            .from('app_sync')
            .select('key, updated_at')
            .order('key', { ascending: true })
            .range(start, start + pageSize - 1);

          if (error) throw error;
          for (const row of rows || []) {
            metaRows.push({
              key: row.key,
              updated_at: row.updated_at ? String(row.updated_at) : null
            });
          }
          if (!rows || rows.length < pageSize) break;
          start += pageSize;
        }

        const cloudMealKeys = new Set<string>();
        const changedKeys: string[] = [];

        for (const row of metaRows) {
          if (row.key.startsWith(FEATURED_MEAL_KEY_PREFIX)) {
            const rawId = decodeURIComponent(row.key.slice(FEATURED_MEAL_KEY_PREFIX.length));
            cloudMealKeys.add(rawId);
          }

          const isRelevant =
            row.key.startsWith(FEATURED_MEAL_KEY_PREFIX) ||
            row.key.startsWith(ORDER_KEY_PREFIX) ||
            ((SYNC_KEYS as readonly string[]).includes(row.key) &&
              row.key !== 'app_orders' &&
              row.key !== 'app_featured_meals');

          if (!isRelevant) continue;

          const prevStamp = this.knownCloudUpdatedAt.get(row.key);
          if (!row.updated_at || prevStamp !== row.updated_at) {
            changedKeys.push(row.key);
          }
        }

        // Remove featured meals that were deleted in cloud.
        let mealsChanged = false;
        if (cloudMealKeys.size > 0 || this.hasCloudFeaturedMealsKey) {
          for (const localId of Array.from(this.featuredMeals.keys())) {
            if (!cloudMealKeys.has(localId)) {
              this.featuredMeals.delete(localId);
              this.syncedFeaturedMealVersions.delete(localId);
              this.knownCloudUpdatedAt.delete(`${FEATURED_MEAL_KEY_PREFIX}${encodeURIComponent(localId)}`);
              mealsChanged = true;
            }
          }
        }

        let ordersChanged = false;

        if (changedKeys.length > 0) {
          for (let i = 0; i < changedKeys.length; i += 50) {
            const batchKeys = changedKeys.slice(i, i + 50);
            const { data: fullRows, error } = await this.supabase
              .from('app_sync')
              .select('key, data, updated_at')
              .in('key', batchKeys);

            if (error) throw error;

            for (const row of fullRows || []) {
              if (row.updated_at) {
                this.knownCloudUpdatedAt.set(row.key, String(row.updated_at));
              }

              if (row.key.startsWith(FEATURED_MEAL_KEY_PREFIX)) {
                const meal = this.toFeaturedMeal(row.data);
                if (!meal) continue;
                const k = this.keyOf(meal.id);
                const serialized = JSON.stringify(meal);
                if (this.syncedFeaturedMealVersions.get(k) !== serialized) {
                  this.featuredMeals.set(k, meal);
                  this.syncedFeaturedMealVersions.set(k, serialized);
                  mealsChanged = true;
                }
              } else if (row.key.startsWith(ORDER_KEY_PREFIX)) {
                const order = this.toOrder(row.data);
                if (!order) continue;
                const k = this.keyOf(order.id);
                const serialized = JSON.stringify(order);
                if (this.syncedOrderVersions.get(k) !== serialized) {
                  this.orders.set(k, order);
                  this.syncedOrderVersions.set(k, serialized);
                  ordersChanged = true;
                }
              } else if ((SYNC_KEYS as readonly string[]).includes(row.key)) {
                this.ngZone.run(() => this.applyOtherKey(row.key, row.data, false));
              }
            }
          }
        }

        if (mealsChanged) {
          this.publishFeaturedMeals();
        }
        if (ordersChanged) {
          this.publishOrders();
        }
      } catch (error) {
        console.error('Cloud delta sync error:', error);
      } finally {
        this.cloudSyncInFlight = null;
      }
    })();

    return this.cloudSyncInFlight;
  }

  private watchDirectKeys(): void {
    const keys = ['store_location', 'admin_gcash_info', 'app_categories'];
    for (const key of keys) {
      this.lastDirectWatch[key] = localStorage.getItem(key) || '';
    }

    window.setInterval(() => {
      for (const key of keys) {
        const current = localStorage.getItem(key) || '';
        if (!current || current === this.lastDirectWatch[key]) continue;

        this.lastDirectWatch[key] = current;
        const data = this.parseValue(current);
        this.ngZone.run(() => this.changesSubject.next({ key, data }));
        void this.pushKey(key, data);
      }
    }, 1500);
  }

  private applyOtherKey(key: string, data: any, forceEmit: boolean): void {
    try {
      const serialized = typeof data === 'string' ? data : JSON.stringify(data);
      const current = localStorage.getItem(key);
      if (current === serialized && !forceEmit) return;

      if (current !== serialized) localStorage.setItem(key, serialized);
      if (Object.prototype.hasOwnProperty.call(this.lastDirectWatch, key)) {
        this.lastDirectWatch[key] = serialized;
      }
      this.changesSubject.next({ key, data });
    } catch (error) {
      console.error(`Failed applying remote key ${key}:`, error);
    }
  }

  private parseValue(raw: string): any {
    try { return JSON.parse(raw); } catch { return raw; }
  }

  private toOrder(value: any): SyncedOrder | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.id === undefined || value.id === null) return null;
    const key = String(value.id).trim();
    if (!key) return null;
    return { ...value, id: value.id };
  }

  private parseOrders(value: any): SyncedOrder[] {
    let parsed = value;
    if (typeof parsed === 'string') parsed = this.parseValue(parsed);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => this.toOrder(item))
      .filter((item): item is SyncedOrder => item !== null);
  }

  /** Accept arrays saved by old and new admin pages while preserving numeric/string IDs. */
  private toFeaturedMeal(value: any): SyncedFeaturedMeal | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.id === undefined || value.id === null) return null;
    const key = String(value.id).trim();
    if (!key) return null;

    const toOptions = (options: any): any[] => {
      if (Array.isArray(options)) return options;
      if (typeof options === 'string') {
        return options.split(',').map((part: string) => part.trim()).filter(Boolean);
      }
      return [];
    };

    return {
      ...value,
      id: value.id,
      variations: toOptions(value.variations),
      sizes: toOptions(value.sizes)
    };
  }

  private parseFeaturedMeals(value: any): SyncedFeaturedMeal[] {
    const parsed = typeof value === 'string' ? this.parseValue(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => this.toFeaturedMeal(item))
      .filter((item): item is SyncedFeaturedMeal => item !== null);
  }

  private mergeFeaturedMeals(meals: SyncedFeaturedMeal[]): void {
    for (const meal of meals) this.featuredMeals.set(this.keyOf(meal.id), meal);
  }

  private replaceFeaturedMeals(meals: SyncedFeaturedMeal[]): void {
    this.featuredMeals.clear();
    for (const meal of meals) this.featuredMeals.set(this.keyOf(meal.id), meal);
  }

  private getAllFeaturedMeals(): SyncedFeaturedMeal[] {
    return Array.from(this.featuredMeals.values());
  }

  private publishFeaturedMeals(): void {
    const meals = this.getAllFeaturedMeals();
    const serialized = JSON.stringify(meals);
    try {
      if (localStorage.getItem('app_featured_meals') !== serialized) {
        localStorage.setItem('app_featured_meals', serialized);
      }
    } catch (error) {
      console.error('Could not cache featured meals locally:', error);
    }
    this.ngZone.run(() => this.changesSubject.next({ key: 'app_featured_meals', data: meals }));
  }

  private mergeOrders(orders: SyncedOrder[]): void {
    for (const order of orders) this.orders.set(this.keyOf(order.id), order);
  }

  private getAllOrders(): SyncedOrder[] {
    return Array.from(this.orders.values()).sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime() || 0;
      const bDate = new Date(b.createdAt || 0).getTime() || 0;
      return bDate - aDate || this.keyOf(b.id).localeCompare(this.keyOf(a.id));
    });
  }

  /** Continue publishing a full local array for the existing OrderService. */
  private publishOrders(): void {
    const orders = this.getAllOrders();
    const serialized = JSON.stringify(orders);
    try {
      if (localStorage.getItem('app_orders') !== serialized) {
        localStorage.setItem('app_orders', serialized);
      }
    } catch (error) {
      console.error('Could not cache orders locally:', error);
    }
    this.ngZone.run(() => this.changesSubject.next({ key: 'app_orders', data: orders }));
  }

  private async writeOrderRows(orders: SyncedOrder[], insertOnly: boolean): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < orders.length; i += 50) {
      const batch = orders.slice(i, i + 50).map((order) => ({
        key: `${ORDER_KEY_PREFIX}${encodeURIComponent(this.keyOf(order.id))}`,
        data: order,
        updated_at: now
      }));

      const { error } = await this.supabase.from('app_sync').upsert(batch, {
        onConflict: 'key',
        ignoreDuplicates: insertOnly
      });
      if (error) throw error;

      if (!insertOnly) {
        for (const row of batch) {
          this.knownCloudUpdatedAt.set(row.key, now);
        }
      }
    }
  }

  private async pushOrders(value: any): Promise<void> {
    await this.ordersReady;
    const incoming = this.parseOrders(value);
    const changed = incoming.filter(
      (order) => this.syncedOrderVersions.get(this.keyOf(order.id)) !== JSON.stringify(order)
    );
    if (!changed.length) return;

    this.mergeOrders(changed);
    this.publishOrders();
    this.broadcastChannel?.postMessage({
      tabId: this.tabId,
      key: 'app_orders',
      data: this.getAllOrders()
    });

    try {
      await this.writeOrderRows(changed, false);
      for (const order of changed) {
        this.syncedOrderVersions.set(this.keyOf(order.id), JSON.stringify(order));
      }
    } catch (error) {
      console.error('Could not sync orders to Supabase:', error);
      throw error;
    }
  }

  private async writeFeaturedMealRows(
    meals: SyncedFeaturedMeal[],
    insertOnly: boolean
  ): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < meals.length; i += 50) {
      const batch = meals.slice(i, i + 50).map((meal) => ({
        key: `${FEATURED_MEAL_KEY_PREFIX}${encodeURIComponent(this.keyOf(meal.id))}`,
        data: meal,
        updated_at: now
      }));

      const { error } = await this.supabase.from('app_sync').upsert(batch, {
        onConflict: 'key',
        ignoreDuplicates: insertOnly
      });
      if (error) throw error;

      if (!insertOnly) {
        for (const row of batch) {
          this.knownCloudUpdatedAt.set(row.key, now);
        }
      }
    }
  }

  private async deleteFeaturedMealRows(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const keys = ids.map((id) => `${FEATURED_MEAL_KEY_PREFIX}${encodeURIComponent(id)}`);
    const { error } = await this.supabase.from('app_sync').delete().in('key', keys);
    if (error) throw error;
    for (const k of keys) {
      this.knownCloudUpdatedAt.delete(k);
    }
  }

  private async upsertRawKey(key: string, data: any): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase.from('app_sync').upsert(
      { key, data, updated_at: now },
      { onConflict: 'key' }
    );
    if (error) throw error;
    this.knownCloudUpdatedAt.set(key, now);
  }

  private async pushFeaturedMeals(value: any): Promise<void> {
    await this.featuredMealsReady;
    const incoming = this.parseFeaturedMeals(value);
    const incomingIds = new Set(incoming.map((m) => this.keyOf(m.id)));

    const deletedIds = Array.from(this.featuredMeals.keys()).filter(
      (id) => !incomingIds.has(id)
    );
    const changed = incoming.filter(
      (meal) => this.syncedFeaturedMealVersions.get(this.keyOf(meal.id)) !== JSON.stringify(meal)
    );

    if (!changed.length && !deletedIds.length) return;

    this.replaceFeaturedMeals(incoming);
    this.publishFeaturedMeals();
    this.broadcastChannel?.postMessage({
      tabId: this.tabId,
      key: 'app_featured_meals',
      data: this.getAllFeaturedMeals()
    });

    try {
      if (deletedIds.length) {
        await this.deleteFeaturedMealRows(deletedIds);
        for (const id of deletedIds) {
          this.syncedFeaturedMealVersions.delete(id);
        }
      }
      if (changed.length) {
        await this.writeFeaturedMealRows(changed, false);
        for (const meal of changed) {
          this.syncedFeaturedMealVersions.set(this.keyOf(meal.id), JSON.stringify(meal));
        }
      }
      this.hasCloudFeaturedMealsKey = true;
      await this.upsertRawKey('app_featured_meals', this.getAllFeaturedMeals());
    } catch (error) {
      console.error('Could not sync featured meals to Supabase:', error);
      throw error;
    }
  }

  /**
   * Optional admin helper to create featured meals without rewriting cloud arrays.
   */
  async createFeaturedMeal(input: FeaturedMealInput): Promise<SyncedFeaturedMeal> {
    await this.featuredMealsReady;

    const newFeaturedMeal: SyncedFeaturedMeal = {
      id: Date.now(),
      name: input.mealName,
      price: Number(input.mealPrice),
      originalPrice: Number(input.mealOriginalPrice || 0),
      stock: Number(input.mealStock || 0),
      image: input.mealImage || '',
      variations: input.variationInput
        ? input.variationInput.split(',').map((v: string) => v.trim()).filter(Boolean)
        : [],
      sizes: input.sizeInput
        ? input.sizeInput.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
    };

    if (!newFeaturedMeal.name?.trim() || !Number.isFinite(newFeaturedMeal.price)) {
      throw new Error('A featured meal must have a name and a valid price.');
    }

    const updatedMeals = [...this.getAllFeaturedMeals(), newFeaturedMeal];
    localStorage.setItem('app_featured_meals', JSON.stringify(updatedMeals));
    await this.pushKey('app_featured_meals', updatedMeals);
    return newFeaturedMeal;
  }

  /** Existing service API: app_orders & app_featured_meals sync per ID safely. */
  async pushKey(key: string, data: any): Promise<void> {
    if (key === 'app_orders') {
      const queued = this.orderWriteQueue.then(() => this.pushOrders(data));
      this.orderWriteQueue = queued.catch((error) => {
        console.error('Queued order sync failed:', error);
      });
      return queued;
    }

    if (key === 'app_featured_meals') {
      const queued = this.featuredMealWriteQueue.then(() => this.pushFeaturedMeals(data));
      this.featuredMealWriteQueue = queued.catch((error) => {
        console.error('Queued featured-meal sync failed:', error);
      });
      return queued;
    }

    try {
      if (Object.prototype.hasOwnProperty.call(this.lastDirectWatch, key)) {
        this.lastDirectWatch[key] =
          typeof data === 'string' ? data : JSON.stringify(data);
      }

      this.broadcastChannel?.postMessage({ tabId: this.tabId, key, data });

      const now = new Date().toISOString();
      const { error } = await this.supabase.from('app_sync').upsert(
        { key, data, updated_at: now },
        { onConflict: 'key' }
      );
      if (error) {
        console.error(`Supabase pushKey error (${key}):`, error);
      } else {
        this.knownCloudUpdatedAt.set(key, now);
      }
    } catch (error) {
      console.error(`Supabase pushKey failed (${key}):`, error);
    }
  }
}