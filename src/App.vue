<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { usePwaStore, type BeforeInstallPromptEvent } from 'src/stores/pwa';

const pwaStore = usePwaStore();

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    pwaStore.setDeferredPrompt(e as BeforeInstallPromptEvent);
  });
});

</script>
