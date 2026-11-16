import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Protects rider-only pages. Riders who are not signed in are sent to the
 * Rider Portal login.
 */
export const riderGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isRiderLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/rider-auth']);
};
