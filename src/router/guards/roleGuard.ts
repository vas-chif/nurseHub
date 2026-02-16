/**
 * @file roleGuard.ts
 * @description Route guard for role-based access control
 * @author Nurse Hub Team
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';

export function roleGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
): void {
  const authStore = useAuthStore();

  // Check if route requires admin role
  if (to.meta.requiresAdmin) {
    if (!authStore.isAdmin) {
      // Non-admin users are redirected to home
      next('/');
      return;
    }
  }

  next();
}
