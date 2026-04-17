/**
 * @file PwaInstallBanner.vue
 * @description A premium banner to encourage users to install the PWA
 * @author Nurse Hub Team
 * @created 2026-04-17
 * @modified 2026-04-17
 * @example
 * <PwaInstallBanner />
 * @notes
 * - Uses the pwaStore to detect installability
 * - Provides a visual guide for desktop users
 * - Premium design with gradients and animations
 * @dependencies
 * - quasar
 * - src/stores/pwaStore
 */

<script setup lang="ts">
import { usePwaStore } from 'src/stores/pwaStore';
import { useQuasar } from 'quasar';
import { ref } from 'vue';

const pwaStore = usePwaStore();
const $q = useQuasar();
const showHelp = ref(false);

/**
 * Triggers the PWA installation process
 */
const installApp = async () => {
  if (pwaStore.isSafari && !pwaStore.deferredPrompt) {
    showHelp.value = true;
    return;
  }

  const result = await pwaStore.install();
  if (result) {
    $q.notify({
      type: 'positive',
      message: '🎉 Installazione completata! Grazie per aver scelto Nurse Hub.',
      position: 'top',
    });
  }
}; /*end installApp*/

/**
 * Dismisses the banner for the current session
 */
const dismiss = () => {
  pwaStore.dismiss();
}; /*end dismiss*/
</script>

<template>
  <div v-if="pwaStore.isInstallable" class="pwa-banner-container">
    <q-banner dense class="pwa-premium-banner text-white q-py-sm">
      <template v-slot:avatar>
        <q-avatar size="40px" color="amber" text-color="primary" class="q-mr-sm">
          <q-icon name="star" />
        </q-avatar>
      </template>

      <div class="column justify-center h-full">
        <span class="text-weight-bold text-subtitle1">Installa l'app per un'esperienza migliore!</span>
        <span class="text-caption opacity-80">
          Più veloce, sicura e sempre pronta sul tuo desktop.
        </span>
      </div>

      <template v-slot:action>
        <div class="row items-center">
          <q-btn
            flat
            dense
            icon="help_outline"
            class="q-mr-md"
            @click="showHelp = true"
            v-if="pwaStore.isSafari && !pwaStore.deferredPrompt"
          >
            <q-tooltip>Come installare su Safari?</q-tooltip>
          </q-btn>

          <q-btn
            flat
            label="Più Tardi"
            color="white"
            class="q-mr-sm text-capitalize"
            @click="dismiss"
          />
          <q-btn
            unelevated
            rounded
            label="INSTALLA ORA"
            color="white"
            text-color="primary"
            icon="download_for_offline"
            class="install-btn text-weight-bold q-px-md shadow-2"
            @click="installApp"
          />
        </div>
      </template>
    </q-banner>

    <!-- Visual Guide Dialog -->
    <q-dialog v-model="showHelp">
      <q-card style="min-width: 350px" class="q-pa-md">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            Guida all'installazione {{ pwaStore.isSafari ? 'iOS / Safari' : 'Desktop' }}
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div v-if="pwaStore.isSafari" class="column q-gutter-md">
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">1</q-avatar>
              <div class="text-body2">
                Tocca il pulsante <strong>Condividi</strong> (quadrato con freccia verso l'alto) nella barra di
                navigazione.
              </div>
            </div>
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">2</q-avatar>
              <div class="text-body2">Scorri verso il basso e tocca <strong>"Aggiungi alla schermata Home"</strong>.</div>
            </div>
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">3</q-avatar>
              <div class="text-body2">Tocca <strong>"Aggiungi"</strong> in alto a destra per confermare.</div>
            </div>
          </div>

          <div v-else class="column q-gutter-md">
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">1</q-avatar>
              <div class="text-body2">Clicca sul pulsante <strong>"Installa Ora"</strong> nel banner blu.</div>
            </div>
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">2</q-avatar>
              <div class="text-body2">
                Conferma l'installazione nel popup del browser (solitamente in alto a destra).
              </div>
            </div>
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">3</q-avatar>
              <div class="text-body2">
                Nurse Hub verrà aggiunto alle tue applicazioni e potrai avviarla dal desktop o dal menu start.
              </div>
            </div>
          </div>

          <q-separator class="q-my-md" />

          <div class="text-caption text-grey-7 italic">
            Nota: Se non vedi il banner, assicurati di usare Chrome, Edge o Safari e di non essere in modalità
            Incognito.
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Ho capito" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped lang="scss">
.pwa-banner-container {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: 90%;
  max-width: 850px;
  animation: slideUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.pwa-premium-banner {
  background: linear-gradient(135deg, $primary 0%, #0d47a1 100%);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  padding: 8px 16px;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }
}

.install-btn {
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.2);
    filter: brightness(1.1);
  }
}

.opacity-80 {
  opacity: 0.8;
}

@keyframes slideUp {
  0% {
    transform: translate(-50%, 120px);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

/* Mobile adjustments */
@media (max-width: 600px) {
  .pwa-banner-container {
    bottom: 20px;
    width: calc(100% - 32px);
  }

  .pwa-premium-banner {
    flex-direction: column;
    align-items: center;
    text-align: center;

    :deep(.q-banner__actions) {
      margin-top: 12px;
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
