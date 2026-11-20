
import { Injectable, inject } from '@angular/core';

import {
  combineLatest,
  map,
  Observable,
  shareReplay
} from 'rxjs';

import { Order } from '../models/food.model';
import { AuthService } from './auth';
import { OrderService } from './order';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderHistoryService {

  private readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);

  readonly orders$: Observable<Order[]> = combineLatest([
    this.orderService.orders$,
    this.authService.currentUser$
  ]).pipe(
    map(([orders, user]) => {

      // A customer must be logged in.
      if (!user) {
        return [];
      }

      const currentPhone = this.normalizePhone(user.phone);

      if (!currentPhone) {
        return [];
      }

      // Only display orders belonging to the
      // currently logged-in customer.
      return (orders || []).filter(order => {
        return this.normalizePhone(order.customerPhone)
          === currentPhone;
      });

    }),
    shareReplay({
      bufferSize: 1,
      refCount: true
    })
  );

  private normalizePhone(
    value: string | null | undefined
  ): string {

    const digits = String(value ?? '')
      .replace(/\D/g, '');

    if (
      digits.length === 12 &&
      digits.startsWith('63')
    ) {
      return '0' + digits.slice(2);
    }

    return digits;
  }
}
