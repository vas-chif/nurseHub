/**
 * @file pwaStore.ts
 * @description State management for PWA installation and lifecycle events
 * @author Nurse Hub Team
 * @created 2026-04-17
 * @modified 2026-04-17
 * @example
 * import { usePwaStore } from 'src/stores/pwaStore';
 * const pwaStore = usePwaStore();
 * if (pwaStore.isInstallable) { ... }
 * @notes
 * - Handles the 'beforeinstallprompt' event for custom install banners
 * - Provides UA detection for Safari specific clues
 * @dependencies
 * - pinia
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useSecureLogger } from '../utils/secureLogger';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Capture events globally before any Vue code runs to prevent race conditions
let capturedDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    capturedDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export const usePwaStore = defineStore('pwa', () => {
  const logger = useSecureLogger();
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(capturedDeferredPrompt);
  
  // Also attach listener inside in case the event fires later
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
    });
  }

  // Initialize state from localStorage
  const isInstalled = ref(localStorage.getItem('pwa_installed') === 'true');
  const isSafari = ref(false);
  const isDismissed = ref(false); 
  const DISMISS_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  const STORAGE_KEY_DISMISS = 'pwa_dismissed_until';

  // Check on boot if we are still in cooldown
  const storedDismiss = localStorage.getItem(STORAGE_KEY_DISMISS);
  if (storedDismiss) {
    const dismissUntil = parseInt(storedDismiss, 10);
    if (Date.now() < dismissUntil) {
      isDismissed.value = true;
      // Setup timeout to clear it when time expires
      setTimeout(() => {
        isDismissed.value = false;
        localStorage.removeItem(STORAGE_KEY_DISMISS);
      }, dismissUntil - Date.now());
    } else {
      localStorage.removeItem(STORAGE_KEY_DISMISS);
    }
  }

  const isInstallable = computed(() => {
    // Se è già stato scartato (cooldown attivo) o è già installato, non mostrare nulla
    if (isDismissed.value || isInstalled.value) return false;
    
    // Su Chrome/Edge/Android abbiamo l'evento nativo
    if (deferredPrompt.value) return true;
    
    // Su Safari (iOS/Mac)
    return isSafari.value;
  });

  function setSafari(status: boolean) {
    isSafari.value = status;
  }

  function setDeferredPrompt(e: BeforeInstallPromptEvent) {
    logger.info('[PWA_STORE] Prompt di installazione catturato e salvato');
    deferredPrompt.value = e;
  }

  function dismiss() {
    isDismissed.value = true;
    const dismissUntil = Date.now() + DISMISS_COOLDOWN_MS;
    localStorage.setItem(STORAGE_KEY_DISMISS, dismissUntil.toString());
    
    logger.info('[PWA_STORE] Banner scartato, ricomparirà tra 10 minuti');
    
    setTimeout(() => {
      isDismissed.value = false;
      localStorage.removeItem(STORAGE_KEY_DISMISS);
      logger.info('[PWA_STORE] Cooldown scaduto, banner pronto a ricomparire');
    }, DISMISS_COOLDOWN_MS);
  }

  function setInstalled(status: boolean) {
    isInstalled.value = status;
    if (status) {
      deferredPrompt.value = null;
      localStorage.setItem('pwa_installed', 'true');
    }
  }

  async function install() {
    if (!deferredPrompt.value) {
      logger.warn('[PWA_STORE] Tentativo di installazione senza prompt disponibile');
      return false;
    }

    try {
      await deferredPrompt.value.prompt();
      const { outcome } = await deferredPrompt.value.userChoice;
      logger.info('[PWA_STORE] Esito installazione:', { outcome });
      
      if (outcome === 'accepted') {
        setInstalled(true);
      }
      
      deferredPrompt.value = null;
      return outcome === 'accepted';
    } catch (error) {
      logger.error('[PWA_STORE] Errore durante l\'installazione:', error);
      return false;
    }
  }

  return {
    deferredPrompt,
    isInstallable,
    isInstalled,
    isSafari,
    setDeferredPrompt,
    setInstalled,
    setSafari,
    dismiss,
    install
  };
});


