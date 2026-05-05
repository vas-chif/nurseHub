/**
 * @file auth.ts
 * @description Quasar boot file — initialises Firebase Auth listener and
 *   populates authStore (currentUser, role, operator) before the app renders.
 * @author Nurse Hub Team
 * @created 2026-01-15
 */
import { boot } from 'quasar/wrappers';
import { useAuthStore } from 'stores/authStore';

export default boot(async () => {
  const authStore = useAuthStore();
  await authStore.init();
});
