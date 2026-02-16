/**
 * @file authGuard.ts
 * @description Route guard to protect authenticated routes
 * @author Nurse Hub Team
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';

export function authGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
): void {
  const authStore = useAuthStore();

  // Check if route requires authentication
  if (to.meta.requiresAuth) {
    // Wait for auth state to be initialized
    if (!authStore.isAuthenticated) {
      // Store intended destination for post-login redirect
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      });
      return;
    }

    // Check if route requires verification
    if (to.meta.requiresVerified && !authStore.isVerified) {
      next('/pending-verification');
      return;
    }
  }

  next();
}
