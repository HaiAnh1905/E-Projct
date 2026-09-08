import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('auth_token');
    const email = localStorage.getItem('user_email');
    const role = localStorage.getItem('user_role') || (email === 'admin@gmail.com' ? 'admin' : 'user');

    console.log('>>> authGuard - token:', token, 'role:', role);

    if (token) {
      if (role === 'admin') {
        return true;
      } else {
        // If logged in as non-admin (user), redirect to /home
        return router.createUrlTree(['/home']);
      }
    }
  }

  // Not logged in -> redirect to /login
  return router.createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = (route, state) => {
  return authGuard(route, state);
};

