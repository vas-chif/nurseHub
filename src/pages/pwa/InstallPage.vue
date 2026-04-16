<!-- src/pages/pwa/InstallPage.vue -->
<script setup lang="ts">
/**
 * @file InstallPage.vue
 * @description PWA Installation Guide for iOS and Android
 * @author NurseHub Team
 * @created 2026-04-16
 */

import { ref, onMounted, computed } from 'vue';
import { useSecureLogger } from 'src/utils/secureLogger';
import { usePwaStore } from 'src/stores/pwa';

// Composables
const logger = useSecureLogger();
const pwaStore = usePwaStore();

// Detection state
const platform = ref<'ios' | 'android' | 'other'>('other');
const isStandalone = ref(false);
const deferredPrompt = computed(() => pwaStore.deferredPrompt);

/**
 * Detect platform and installation state
 */
const detectPlatform = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  logger.info('[PWA] UserAgent detected', { ua });

  // Standalone detection
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  logger.info('[PWA] Standalone Mode status', { isStandalone: isStandalone.value });

  if (/iphone|ipad|ipod/.test(ua)) {
    platform.value = 'ios';
  } else if (/android/.test(ua)) {
    platform.value = 'android';
  } else {
    platform.value = 'other';
  }
  logger.info('[PWA] Platform identified', { platform: platform.value });
};

onMounted(() => {
  logger.info('[PWA] InstallPage mounted');
  detectPlatform();
});

/**
 * Trigger Android installation prompt
 */
const installAndroid = async () => {
  logger.info('[PWA] Triggering install via store');
  const success = await pwaStore.install();
  if (success) {
    logger.info('[PWA] Install success');
  }
};

const guideSlides = computed(() => {
  if (platform.value === 'ios') {
    return [
      {
        title: 'Tocca Condividi',
        description: 'Tocca l\'icona di condivisione nel menu in basso di Safari.',
        icon: 'ios_share',
      },
      {
        title: 'Aggiungi a Home',
        description: 'Scorri verso il basso e tocca "Aggiungi alla schermata Home".',
        icon: 'add_box',
      },
      {
        title: 'Conferma',
        description: 'Tocca "Aggiungi" nell\'angolo in alto a destra.',
        icon: 'check_circle',
      }
    ];
  }
  return [];
});

const slide = ref(1);
</script>

<template>
  <q-page class="install-page flex flex-center q-pa-lg" :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-1'">
    <q-card flat bordered class="install-card shadow-2">
      <q-card-section class="text-center q-pb-none">
        <div class="logo-container q-mb-md">
          <q-img src="icons/icon-128x128.png" style="width: 80px; height: 80px" />
        </div>
        <h1 class="text-h5 text-bold text-primary q-mt-none">NurseHub</h1>
        <p class="text-subtitle1" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-8'">Installa l'app per un'esperienza migliore</p>
      </q-card-section>

      <!-- SUCCESS STATE: Already Installed -->
      <q-card-section v-if="isStandalone" class="text-center">
        <q-icon name="check_circle" color="positive" size="80px" />
        <p class="text-h6 q-mt-md">L'app è già installata!</p>
        <p class="text-body1" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-7'">Puoi chiudere questa pagina e avviare l'app dalla tua schermata Home.</p>
        <q-btn to="/" label="Vai alla Dashboard" color="primary" class="full-width q-mt-lg" rounded unelevated />
      </q-card-section>

      <!-- IOS GUIDE -->
      <q-card-section v-else-if="platform === 'ios'" class="q-pt-none">
        <q-carousel
          v-model="slide"
          transition-prev="slide-right"
          transition-next="slide-left"
          swipeable
          animated
          control-color="primary"
          navigation
          padding
          arrows
          height="280px"
          class="bg-transparent"
        >
          <q-carousel-slide v-for="(step, index) in guideSlides" :key="index" :name="index + 1" class="column no-wrap flex-center">
            <q-icon :name="step.icon" size="56px" color="primary" class="q-mb-md" />
            <div class="text-h6 q-mb-sm">{{ step.title }}</div>
            <p class="text-center text-body2" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-7'">{{ step.description }}</p>
          </q-carousel-slide>
        </q-carousel>

        <div class="text-center q-mt-md">
          <p class="text-caption italic" :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-6'">Richiede Safari su iPhone o iPad</p>
        </div>
      </q-card-section>

      <!-- ANDROID GUIDE -->
      <q-card-section v-else-if="platform === 'android'" class="text-center">
        <div class="q-pa-md">
          <q-icon name="install_mobile" size="80px" color="primary" class="q-mb-md" />
          <p class="text-body1" :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'">
            Tocca il bottone qui sotto per installare l'app direttamente sul tuo dispositivo.
          </p>
          <q-btn
            v-if="deferredPrompt"
            @click="installAndroid"
            label="Installa Ora"
            color="primary"
            class="full-width q-mt-lg"
            rounded
            unelevated
            size="lg"
            icon="download"
          />
          <div v-else class="q-mt-lg q-pa-sm rounded-borders text-caption text-left" :class="$q.dark.isActive ? 'bg-grey-9 text-blue-2' : 'bg-blue-1 text-blue-9'">
            <q-icon name="info" class="q-mr-xs" />
            Se il bottone non appare, tocca i tre puntini <q-icon name="more_vert" /> in alto a destra di Chrome e seleziona "Installa app".
          </div>
        </div>
      </q-card-section>

      <!-- OTHER / DESKTOP -->
      <q-card-section v-else class="text-center">
        <q-icon name="computer" size="64px" color="grey-6" class="q-mb-md" />
        <p class="text-body1" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-8'">Questa app è ottimizzata per dispositivi mobile.</p>
        <p class="text-body2" :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-7'">Apri questo link dal tuo smartphone per installare l'app.</p>
        <q-btn to="/" label="Accedi via Web" color="grey-7" outline class="full-width q-mt-md" rounded />
      </q-card-section>

      <q-card-actions v-if="!isStandalone" vertical align="center" class="q-pb-md">
        <q-btn flat dense to="/" label="Continua via browser" :color="$q.dark.isActive ? 'grey-4' : 'grey-6'" size="sm" />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<style scoped lang="scss">
.install-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);

  &.bg-dark {
    background: linear-gradient(135deg, #1d1d1d 0%, #111111 100%) !important;
  }
}

.install-card {
  width: 100%;
  max-width: 400px;
  border-radius: 20px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}

.body--dark .install-card {
  background: rgba(29, 29, 29, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.1);
}

.logo-container {
  display: flex;
  justify-content: center;
}
</style>
