import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Order } from '../models/food.model';
import { OrderService } from './order';
import { CustomerOrderHistoryService } from './customer-order-history';
import { AuthService } from './auth';

export type MembershipTier = 'Starter' | 'Bronze' | 'Silver' | 'Gold';

export interface MembershipInfo {
  tier: MembershipTier;
  discountPercent: number;
  qualifyingOrders: number;
  nextTier: MembershipTier | null;
  nextRequirement: number;
  ordersToNext: number;
  downgraded: boolean;
  daysSinceLastOrder: number | null;
  bronzeCount2Weeks: number;
  silverCount3Weeks: number;
  goldCount4Weeks: number;
}

interface StoredMembershipState {
  peakTierIndex: number;
  effectiveTierIndex: number;
  lastOrderMs: number | null;
}

const TIER_ORDER: MembershipTier[] = ['Starter', 'Bronze', 'Silver', 'Gold'];
const TIER_DISCOUNTS: Record<MembershipTier, number> = {
  Starter: 0,
  Bronze: 10,
  Silver: 20,
  Gold: 30
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * DAY_MS;
const TWO_WEEKS_MS = 14 * DAY_MS;
const THREE_WEEKS_MS = 21 * DAY_MS;
const FOUR_WEEKS_MS = 28 * DAY_MS;

@Injectable({
  providedIn: 'root'
})
export class MembershipService {
  private orderService = inject(OrderService, { optional: true });
  private customerOrderHistory = inject(CustomerOrderHistoryService);
  private authService = inject(AuthService, { optional: true });

  private latestOrders: Order[] = [];
  private membershipSubject = new BehaviorSubject<MembershipInfo>(
    this.buildInfo('Starter', 0, 0, 0, false, null)
  );
  public membership$ = this.membershipSubject.asObservable();

  constructor() {
    if (this.orderService?.orders$) {
      this.customerOrderHistory.orders$.subscribe((orders) => {
        this.latestOrders = orders || [];
        this.recompute();
      });
    }

    if (this.authService?.currentUser$) {
      this.authService.currentUser$.subscribe(() => {
        this.recompute();
      });
    }
  }

  getCurrentMembership(): MembershipInfo {
    return this.membershipSubject.value;
  }

  refresh(orders?: Order[]): MembershipInfo {
    if (orders) {
      this.latestOrders = orders;
    }
    return this.recompute();
  }

  evaluateMembership(orders: Order[]): MembershipInfo {
    const now = Date.now();
    const list = orders || [];

    // Most recent placed order (any status) for 1-week inactivity downgrade rule
    const placedTimestamps = list
      .map((o) => new Date(o.createdAt).getTime())
      .filter((ms) => !isNaN(ms));
    const lastOrderMs = placedTimestamps.length > 0 ? Math.max(...placedTimestamps) : null;
    const daysSinceLastOrder =
      lastOrderMs !== null ? Math.max(0, Math.floor((now - lastOrderMs) / DAY_MS)) : null;

    const completed = list.filter((o) => o.status === 'Completed');

    const getCompletionMs = (o: Order): number => {
      const raw = (o as any).deliveredAt || o.createdAt;
      const ms = new Date(raw).getTime();
      return isNaN(ms) ? 0 : ms;
    };

    const hasGoodRatingAndFeedback = (o: Order): boolean => {
      const rating = Number(o.rating || 0);
      const feedback = (o.feedback || '').trim();
      return rating >= 4 && feedback.length > 0;
    };

    // Bronze: 10 completed orders with good ratings (>= 4) & feedback within 2 weeks
    const bronzeCount2Weeks = completed.filter(
      (o) => now - getCompletionMs(o) <= TWO_WEEKS_MS && hasGoodRatingAndFeedback(o)
    ).length;

    // Silver: 20 completed orders within 3 weeks
    const silverCount3Weeks = completed.filter(
      (o) => now - getCompletionMs(o) <= THREE_WEEKS_MS
    ).length;

    // Gold: 40 completed orders within 4 weeks
    const goldCount4Weeks = completed.filter(
      (o) => now - getCompletionMs(o) <= FOUR_WEEKS_MS
    ).length;

    let earnedIndex = 0;
    if (goldCount4Weeks >= 40) {
      earnedIndex = 3; // Gold
    } else if (silverCount3Weeks >= 20) {
      earnedIndex = 2; // Silver
    } else if (bronzeCount2Weeks >= 10) {
      earnedIndex = 1; // Bronze
    }

    // Apply 1-week inactivity downgrade rule (1 level down per week without placing an order)
    const storageKey = this.getStorageKey();
    const saved = this.loadState(storageKey);

    let effectiveIndex = earnedIndex;
    let peakIndex = earnedIndex;
    let downgraded = false;

    if (lastOrderMs !== null) {
      const weeksInactive = Math.floor(Math.max(0, now - lastOrderMs) / ONE_WEEK_MS);
      const placedNewOrder =
        saved.lastOrderMs === null || lastOrderMs > saved.lastOrderMs;

      if (weeksInactive >= 1) {
        const baseIndex = Math.max(saved.peakTierIndex, earnedIndex);
        effectiveIndex = Math.max(0, baseIndex - weeksInactive);
        peakIndex = baseIndex;
        downgraded = effectiveIndex < baseIndex;
      } else if (placedNewOrder) {
        effectiveIndex = Math.max(saved.effectiveTierIndex, earnedIndex);
        peakIndex = effectiveIndex;
      } else {
        effectiveIndex = Math.max(saved.effectiveTierIndex, earnedIndex);
        peakIndex = Math.max(saved.peakTierIndex, effectiveIndex);
      }
    }

    this.saveState(storageKey, {
      peakTierIndex: peakIndex,
      effectiveTierIndex: effectiveIndex,
      lastOrderMs
    });

    const finalTier = TIER_ORDER[effectiveIndex];
    return this.buildInfo(
      finalTier,
      bronzeCount2Weeks,
      silverCount3Weeks,
      goldCount4Weeks,
      downgraded,
      daysSinceLastOrder
    );
  }

  private recompute(): MembershipInfo {
    const info = this.evaluateMembership(this.latestOrders);
    this.membershipSubject.next(info);
    return info;
  }

  private buildInfo(
    tier: MembershipTier,
    bronzeCount2Weeks: number,
    silverCount3Weeks: number,
    goldCount4Weeks: number,
    downgraded: boolean,
    daysSinceLastOrder: number | null
  ): MembershipInfo {
    const discountPercent = TIER_DISCOUNTS[tier];

    let qualifyingOrders = bronzeCount2Weeks;
    let nextTier: MembershipTier | null = 'Bronze';
    let nextRequirement = 10;

    if (tier === 'Starter') {
      qualifyingOrders = bronzeCount2Weeks;
      nextTier = 'Bronze';
      nextRequirement = 10;
    } else if (tier === 'Bronze') {
      qualifyingOrders = silverCount3Weeks;
      nextTier = 'Silver';
      nextRequirement = 20;
    } else if (tier === 'Silver') {
      qualifyingOrders = goldCount4Weeks;
      nextTier = 'Gold';
      nextRequirement = 40;
    } else {
      qualifyingOrders = goldCount4Weeks;
      nextTier = null;
      nextRequirement = 40;
    }

    const ordersToNext = nextTier ? Math.max(0, nextRequirement - qualifyingOrders) : 0;

    return {
      tier,
      discountPercent,
      qualifyingOrders,
      nextTier,
      nextRequirement,
      ordersToNext,
      downgraded,
      daysSinceLastOrder,
      bronzeCount2Weeks,
      silverCount3Weeks,
      goldCount4Weeks
    };
  }

  private getStorageKey(): string {
    const user = this.authService?.getCurrentUser?.();
    const id = (user && (user.phone || user.email || user.fullName)) || 'guest';
    return `membership_state_${String(id).toLowerCase()}`;
  }

  private loadState(key: string): StoredMembershipState {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          peakTierIndex: Number(parsed.peakTierIndex) || 0,
          effectiveTierIndex: Number(parsed.effectiveTierIndex) || 0,
          lastOrderMs: parsed.lastOrderMs ?? null
        };
      }
    } catch {}
    return { peakTierIndex: 0, effectiveTierIndex: 0, lastOrderMs: null };
  }

  private saveState(key: string, state: StoredMembershipState) {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }
}