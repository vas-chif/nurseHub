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

/**
 * Interface for the beforeinstallprompt event
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePwaStore = defineStore('pwa', () => {
  const logger = useSecureLogger();
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
  
  const isInstalled = ref(false);
  const internalSafari = ref(false);
  const isDismissed = ref(false); // true finché non scade il cooldown
  const DISMISS_COOLDOWN_MS = 10 * 60 * 1000; // 10 minuti

  /**
   * Detects if the app is already running in standalone mode (installed)
   */
  const checkStandalone = () => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  };

  /**
   * Detects if the browser is Safari on iOS/macOS
   */
  const checkSafari = () => {
    const ua = window.navigator.userAgent;
    const isIPad = !!ua.match(/iPad/i);
    const isIPhone = !!ua.match(/iPhone/i);
    const isMac = !!ua.match(/Macintosh/i);
    const isSafariBrowser = !!ua.match(/Safari/i) && !ua.match(/CriOS/i) && !ua.match(/FxiOS/i);
    return (isIPad || isIPhone || isMac) && isSafariBrowser;
  };

  const isSafari = computed(() => internalSafari.value);

  const isInstallable = computed(() => {
    // Se è già stato scartato (cooldown attivo) o è già installato, non mostrare nulla
    if (isDismissed.value || isInstalled.value) return false;
    
    // Su Chrome/Edge/Android abbiamo l'evento nativo
    if (deferredPrompt.value) return true;
    
    // Su Safari (iOS/Mac)
    return isSafari.value;
  });

  function setSafari(status: boolean) {
    internalSafari.value = status;
  }

  function setInstalled(status: boolean) {
    isInstalled.value = status;
    if (status) {
      deferredPrompt.value = null;
    }
  }

  function setDeferredPrompt(e: BeforeInstallPromptEvent) {
    logger.info('[PWA_STORE] Prompt di installazione catturato e salvato');
    deferredPrompt.value = e;
  }

  /**
   * Initializes the PWA event listeners
   */
  function init() {
    // Auto-inizializza stato browser
    setSafari(checkSafari());
    setInstalled(checkStandalone());

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    });

    window.addEventListener('appinstalled', () => {
      logger.info('[PWA_STORE] App installata con successo');
      setInstalled(true);
    });
  } /*end init*/

  function dismiss() {
    isDismissed.value = true;
    logger.info('[PWA_STORE] Banner scartato, ricomparirà tra 10 minuti');
    setTimeout(() => {
      isDismissed.value = false;
      logger.info('[PWA_STORE] Cooldown scaduto, banner pronto a ricomparire');
    }, DISMISS_COOLDOWN_MS);
  } /*end dismiss*/

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
  } /*end install*/

  return {
    deferredPrompt,
    isInstallable,
    isInstalled,
    isSafari,
    setDeferredPrompt,
    setInstalled,
    setSafari,
    init,
    dismiss,
    install,
  };
}); /*end usePwaStore*/

