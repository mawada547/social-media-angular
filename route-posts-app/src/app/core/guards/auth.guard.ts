import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects authenticated routes by verifying an active authentication token
 * and redirecting unauthenticated visitors to the login page.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getToken() && authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
