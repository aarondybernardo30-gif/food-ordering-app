import { Injectable, NgZone, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Subject } from 'rxjs';

const SUPABASE_URL = 'https://lexlpygvyxxtbeshlhyc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_b0kAlxUPIWQfsZnsr2CUHA_hO6P6p7c';

/** Keys synced across PC and Mobile via Supabase `app_sync` table */
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

@Injectable({
  providedIn: 'root'
})
export class CloudSyncService {
  private ngZone = inject(NgZone);
  private supabase: SupabaseClient;
  private changesSubject = new Subject<{ key: string; data: any }>();
  public changes$ = this.changesSubject.asObservable();

  private started = false;
  private lastDirectWatch: Record<string, string> = {};
  private readonly tabId = Math.random().toString(36).slice(2);
  private broadcastChannel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('app_realtime_sync') : null;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    this.init();
  }

  private async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // 0. Instant cross-tab sync within the same browser
    if (this.broadcastChannel) {
      this.broadcastChannel.onmessage = (event) => {
        const msg = event?.data;
        if (!msg || msg.tabId === this.tabId || !msg.key) return;
        this.ngZone.run(() => {
          this.applyLocalOrRemoteUpdate(msg.key, msg.data, true);
        });
      };
    }

    // Fallback cross-tab listener via storage event
    window.addEventListener('storage', (e) => {
      if (!e.key || e.newValue === null) return;
      if ((SYNC_KEYS as readonly string[]).includes(e.key)) {
        this.ngZone.run(() => {
          try {
            const parsed = JSON.parse(e.newValue!);
            this.changesSubject.next({ key: e.key!, data: parsed });
          } catch {
            this.changesSubject.next({ key: e.key!, data: e.newValue });
          }
        });
      }
    });

    try {
      // 1. Fetch all existing cloud state on startup
      const { data: rows, error } = await this.supabase
        .from('app_sync')
        .select('key, data');

      if (!error && Array.isArray(rows)) {
        const cloudMap = new Map<string, any>();
        for (const row of rows) {
          cloudMap.set(row.key, row.data);
          this.ngZone.run(() => {
            this.applyLocalOrRemoteUpdate(row.key, row.data, false);
          });
        }

        // 2. When running on PC Web, automatically upload any local PC data
        //    that isn't in Supabase yet.
        if (!Capacitor.isNativePlatform()) {
          for (const key of SYNC_KEYS) {
            if (!cloudMap.has(key)) {
              const localRaw = localStorage.getItem(key);
              if (localRaw !== null) {
                try {
                  const parsed = JSON.parse(localRaw);
                  await this.pushKey(key, parsed);
                } catch {
                  await this.pushKey(key, localRaw);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Supabase initial sync failed:', err);
    }

    // 3. Subscribe to live Realtime updates (Mobile <-> PC)
    this.supabase
      .channel('app-sync-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_sync' },
        (payload: any) => {
          const record = payload.new;
          if (record && record.key && record.data !== undefined) {
            this.ngZone.run(() => {
              this.applyLocalOrRemoteUpdate(record.key, record.data, false);
            });
          }
        }
      )
      .subscribe();

    // 4. Watch raw localStorage keys that may be edited without a service
    const directKeys = ['store_location', 'admin_gcash_info', 'app_categories'];
    for (const k of directKeys) {
      this.lastDirectWatch[k] = localStorage.getItem(k) || '';
    }
    setInterval(() => {
      for (const k of directKeys) {
        const current = localStorage.getItem(k) || '';
        if (current && current !== this.lastDirectWatch[k]) {
          this.lastDirectWatch[k] = current;
          try {
            const parsed = JSON.parse(current);
            this.ngZone.run(() => this.changesSubject.next({ key: k, data: parsed }));
            this.pushKey(k, parsed);
          } catch {
            this.ngZone.run(() => this.changesSubject.next({ key: k, data: current }));
            this.pushKey(k, current);
          }
        }
      }
    }, 1500);
  }

  private applyLocalOrRemoteUpdate(key: string, data: any, forceEmitFromTab: boolean): void {
    try {
      const serialized = typeof data === 'string' ? data : JSON.stringify(data);
      const current = localStorage.getItem(key);
      if (current === serialized && !forceEmitFromTab) {
        return;
      }
      if (current !== serialized) {
        localStorage.setItem(key, serialized);
      }
      if (key in this.lastDirectWatch) {
        this.lastDirectWatch[key] = serialized;
      }
      this.changesSubject.next({ key, data });
    } catch (err) {
      console.error(`Failed applying remote key ${key}:`, err);
    }
  }

  async pushKey(key: string, data: any): Promise<void> {
    try {
      if (key in this.lastDirectWatch) {
        this.lastDirectWatch[key] = typeof data === 'string' ? data : JSON.stringify(data);
      }
      // Broadcast immediately to other open tabs in the same browser
      this.broadcastChannel?.postMessage({ tabId: this.tabId, key, data });

      const { error } = await this.supabase.from('app_sync').upsert(
        {
          key,
          data,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      );
      if (error) {
        console.error(`Supabase pushKey error (${key}):`, error);
      }
    } catch (err) {
      console.error(`Supabase pushKey failed (${key}):`, err);
    }
  }
}
