import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePwaStore = defineStore('pwa', () => {
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);

  /**
   * Set the deferred prompt from the event
   */
  const setDeferredPrompt = (prompt: BeforeInstallPromptEvent) => {
    deferredPrompt.value = prompt;
  };

  /**
   * Trigger the installation
   */
  const install = async () => {
    if (!deferredPrompt.value) return false;

    await deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    
    if (outcome === 'accepted') {
      deferredPrompt.value = null;
      return true;
    }
    return false;
  };

  return {
    deferredPrompt,
    setDeferredPrompt,
    install
  };
});
