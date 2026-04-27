/**
* @file App.vue
* @description Root component of the application. Handles PWA installation status and global tutorial wizard.
* @author Nurse Hub Team
* @created 2026-02-11
* @modified 2026-04-27
* @notes
* - Detects platform-specific (iOS/Safari) PWA requirements.
* - Integrates global overlays like PwaInstallBanner and TutorialWizard.
*/

<script setup lang="ts">
import { onMounted } from 'vue';
import { usePwaStore } from './stores/pwaStore';
import PwaInstallBanner from './components/PwaInstallBanner.vue';
import TutorialWizard from './components/TutorialWizard.vue';

const pwaStore = usePwaStore();

onMounted(() => {
  // Safari and Standalone detection
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  pwaStore.setInstalled(isStandalone);

  const ua = window.navigator.userAgent;
  const isIPad = !!ua.match(/iPad/i);
  const isIPhone = !!ua.match(/iPhone/i);
  const isMac = !!ua.match(/Macintosh/i);
  const isSafariBrowser = !!ua.match(/Safari/i) && !ua.match(/CriOS/i) && !ua.match(/FxiOS/i);

  if ((isIPad || isIPhone || isMac) && isSafariBrowser) {
    pwaStore.setSafari(true);
    if (isIPad || isIPhone) {
      pwaStore.setIsIOS(true);
    }
  }
});
</script>

<template>
  <router-view />
  <PwaInstallBanner />
  <TutorialWizard />
</template>
