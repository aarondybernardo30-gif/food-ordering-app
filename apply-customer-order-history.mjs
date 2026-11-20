
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';

import {
  dirname,
  relative,
  resolve
} from 'node:path';

// Full customer order history service
const servicePath =
  'src/app/services/customer-order-history.ts';

const serviceCode = `
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
      .replace(/\\D/g, '');

    if (
      digits.length === 12 &&
      digits.startsWith('63')
    ) {
      return '0' + digits.slice(2);
    }

    return digits;
  }
}
`;

// Existing file modifications
const customerImport =
  "import { CustomerOrderHistoryService } from '../../services/customer-order-history';";

const plans = [
  {
    file: 'src/app/pages/me/me.page.ts',
    edits: [
      [
        "import { OrderService } from '../../services/order';",
        "import { OrderService } from '../../services/order';\n" +
          customerImport
      ],
      [
        'private orderService = inject(OrderService, { optional: true });',
        'private orderService = inject(OrderService, { optional: true });\n' +
        '  private customerOrderHistory = inject(CustomerOrderHistoryService);'
      ],
      [
        'this.orderService.orders$.subscribe((orders: Order[]) => {',
        'this.customerOrderHistory.orders$.subscribe((orders: Order[]) => {'
      ]
    ]
  },
  {
    file: 'src/app/pages/menu/menu.page.ts',
    edits: [
      [
        "import { OrderService } from '../../services/order';",
        "import { OrderService } from '../../services/order';\n" +
          customerImport
      ],
      [
        'private orderService = inject(OrderService);',
        'private orderService = inject(OrderService);\n' +
        '  private customerOrderHistory = inject(CustomerOrderHistoryService);'
      ],
      [
        'this.orderService.orders$.subscribe(orders => {',
        'this.customerOrderHistory.orders$.subscribe(orders => {'
      ]
    ]
  },
  {
    file: 'src/app/pages/notifications/notifications.page.ts',
    edits: [
      [
        "import { OrderService } from '../../services/order';",
        "import { OrderService } from '../../services/order';\n" +
          customerImport
      ],
      [
        'private orderService = inject(OrderService);',
        'private orderService = inject(OrderService);\n' +
        '  private customerOrderHistory = inject(CustomerOrderHistoryService);'
      ],
      [
        'this.orderService.orders$.subscribe((data: Order[]) => {',
        'this.customerOrderHistory.orders$.subscribe((data: Order[]) => {'
      ]
    ]
  },
  {
    file: 'src/app/services/membership.ts',
    edits: [
      [
        "import { OrderService } from './order';",
        "import { OrderService } from './order';\n" +
        "import { CustomerOrderHistoryService } from './customer-order-history';"
      ],
      [
        'private orderService = inject(OrderService, { optional: true });',
        'private orderService = inject(OrderService, { optional: true });\n' +
        '  private customerOrderHistory = inject(CustomerOrderHistoryService);'
      ],
      [
        'this.orderService.orders$.subscribe((orders) => {',
        'this.customerOrderHistory.orders$.subscribe((orders) => {'
      ]
    ]
  }
];

// Prevent accidental changes when expected code differs
function replaceOnce(source, search, replacement, file) {
  const index = source.indexOf(search);

  if (index === -1) {
    throw new Error(
      'Expected code not found in ' + file + ': ' + search
    );
  }

  if (source.indexOf(search, index + search.length) !== -1) {
    throw new Error(
      'Multiple matches found in ' + file + ': ' + search
    );
  }

  const result = source.includes('\r\n')
    ? replacement.replaceAll('\n', '\r\n')
    : replacement;

  return source.slice(0, index) +
    result +
    source.slice(index + search.length);
}

// Check every file before modifying anything
const prepared = [];

for (const plan of plans) {
  const path = resolve(plan.file);

  if (!existsSync(path)) {
    throw new Error('File not found: ' + path);
  }

  const original = readFileSync(path, 'utf8');

  if (original.includes('customerOrderHistory.orders$.subscribe')) {
    throw new Error(
      'Already modified: ' + plan.file
    );
  }

  let updated = original;

  for (const [before, after] of plan.edits) {
    updated = replaceOnce(
      updated,
      before,
      after,
      plan.file
    );
  }

  prepared.push({
    path,
    original,
    updated
  });
}

if (existsSync(resolve(servicePath))) {
  throw new Error(
    'Customer order history service already exists.'
  );
}

// Back up original files outside the app repository
const stamp = new Date()
  .toISOString()
  .replace(/[.:]/g, '-');

const backupRoot = resolve(
  '..',
  'customer-order-backup-' + stamp
);

// Apply updates
for (const item of prepared) {
  const backupPath = resolve(
    backupRoot,
    relative(process.cwd(), item.path)
  );

  mkdirSync(dirname(backupPath), {
    recursive: true
  });

  writeFileSync(
    backupPath,
    item.original,
    'utf8'
  );

  writeFileSync(
    item.path,
    item.updated,
    'utf8'
  );

  console.log('Updated:', item.path);
}

writeFileSync(
  resolve(servicePath),
  serviceCode,
  'utf8'
);

console.log('Created:', servicePath);
console.log('Backups:', backupRoot);
console.log('Customer order history update complete!');
