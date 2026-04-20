/**
 * @file useOnboarding.ts
 * @description Composable for managing the onboarding wizard state
 * @author Nurse Hub Team
 * @created 2026-04-19
 * @modified 2026-04-19
 * @example
 * const { showTutorial, completeOnboarding } = useOnboarding(computed(() => user.uid));
 * @notes
 * - Zero Firebase costs (client-side localStorage only)
 * - Persists per-user using UID in localStorage key
 * @dependencies
 * - vue
 */

import { ref, watch, type Ref } from 'vue';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

export function useOnboarding(uidRef: Ref<string | null | undefined>) {
  const showTutorial = ref(false);
  const STORAGE_KEY_PREFIX = 'nursehub_onboarding_completed_';

  const checkStatus = (uid: string) => {
    const key = `${STORAGE_KEY_PREFIX}${uid}`;
    const isCompleted = localStorage.getItem(key) === 'true';
    const isTemporarilyDismissed = sessionStorage.getItem('nursehub_onboarding_dismissed') === 'true';
    
    if (!isCompleted && !isTemporarilyDismissed) {
      showTutorial.value = true;
      logger.info('Mostrando tutorial utente per prima volta');
    } else {
      showTutorial.value = false;
    }
  };

  watch(uidRef, (newUid) => {
    if (newUid) {
      checkStatus(newUid);
    } else {
      showTutorial.value = false;
    }
  }, { immediate: true });

  const completeOnboarding = () => {
    if (uidRef.value) {
      const key = `${STORAGE_KEY_PREFIX}${uidRef.value}`;
      localStorage.setItem(key, 'true');
      showTutorial.value = false;
      logger.info('Tutorial utente completato');
    }
  };

  const dismissTemporarily = () => {
    sessionStorage.setItem('nursehub_onboarding_dismissed', 'true');
    showTutorial.value = false;
    logger.info('Tutorial posticipato per la sessione corrente');
  };

  return {
    showTutorial,
    completeOnboarding,
    dismissTemporarily
  };
}
