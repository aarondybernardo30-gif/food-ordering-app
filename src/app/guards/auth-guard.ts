import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Protects customer-only pages. Unauthenticated visitors are sent to the
 * combined Login / Sign Up page.
 */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isUserLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/register']);
};
