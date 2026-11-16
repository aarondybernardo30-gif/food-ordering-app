import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Protects admin-only pages. Admins who are not signed in are sent to the
 * Admin Portal login.
 */
export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdminLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/admin-auth']);
};
