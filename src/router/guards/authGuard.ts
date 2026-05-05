/**
 * @file authGuard.ts
 * @description Route guard to protect authenticated routes
 * @author Nurse Hub Team
 */

import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';

export async function authGuard(
  to: RouteLocationNormalized,
): Promise<RouteLocationRaw | true> {
  const authStore = useAuthStore();

  // Wait for auth state to be initialized on first load
  if (!authStore.isInitialized) {
    await authStore.init();
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Store intended destination for post-login redirect
      return { path: '/login', query: { redirect: to.fullPath } };
    }

    // Check if route requires verification
    if (to.meta.requiresVerified && !authStore.isVerified) {
      return '/pending-verification';
    }
  }

  return true;
}
