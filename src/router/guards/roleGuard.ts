/**
 * @file roleGuard.ts
 * @description Route guard for role-based access control. Runs after authGuard,
 *   so auth is guaranteed to be initialized when this guard executes.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-05-05
 * @notes
 * - Handles two meta flags: requiresAdmin (any admin) and requiresSuperAdmin (superAdmin only).
 * - Shows a $q.notify-equivalent banner via Notify.create before redirect.
 * - Always redirects to /dashboard (not /) to avoid auth guard loops.
 */

import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import { Notify } from 'quasar';
import { useAuthStore } from '../../stores/authStore';

export function roleGuard(
  to: RouteLocationNormalized,
): RouteLocationRaw | true {
  const authStore = useAuthStore();

  // SuperAdmin-only routes (e.g. /admin — SystemConfig)
  if (to.meta.requiresSuperAdmin && !authStore.isSuperAdmin) {
    Notify.create({
      type: 'negative',
      icon: 'lock',
      message: 'Accesso negato',
      caption: 'Solo i SuperAdmin possono accedere a questa sezione.',
      timeout: 3000,
    });
    return '/dashboard';
  }

  // Admin-or-above routes (e.g. /admin/requests, /admin/users)
  if (to.meta.requiresAdmin && !authStore.isAnyAdmin) {
    Notify.create({
      type: 'negative',
      icon: 'lock',
      message: 'Accesso negato',
      caption: 'Permessi insufficienti per questa pagina.',
      timeout: 3000,
    });
    return '/dashboard';
  }

  return true;
} /*end roleGuard*/
