<script setup lang="ts">
/**
 * @file PwaInstallBanner.vue
 * @description Floating banner that prompts eligible users to install the PWA.
 *   Listens to the beforeinstallprompt event via pwaStore.
 * @author Nurse Hub Team
 * @created 2026-02-10
 */
import { usePwaStore } from '../stores/pwaStore';
import { useQuasar } from 'quasar';
import { ref } from 'vue';

const pwaStore = usePwaStore();
const $q = useQuasar();
const showHelp = ref(false);

const installApp = async () => {
  if (pwaStore.isIOS) {
    showHelp.value = true;
    return;
  }

  const result = await pwaStore.install();
  if (result) {
    $q.notify({
      type: 'positive',
      message: '🎉 Installazione completata! Grazie per aver scelto NurseHub.',
      position: 'top',
    });
  }
};

const dismiss = () => {
  pwaStore.dismiss();
};
</script>

<template>
  <div v-if="pwaStore.isInstallable" class="pwa-banner-container">
    <q-banner dense class="pwa-premium-banner text-white q-py-sm">
      <template v-slot:avatar>
        <q-avatar size="40px" class="q-mr-sm" color="white">
          <q-img src="../assets/icon.png" width="30px" height="30px" />
        </q-avatar>
      </template>

      <div class="column">
        <span class="text-weight-bold text-subtitle1"
          >Installa l'app per un'esperienza migliore!</span
        >
        <span class="text-caption opacity-80">
          Più veloce, sicura e sempre pronta sul tuo desktop.
        </span>
      </div>

      <template v-slot:action>
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
          label="Più tardi"
          color="white"
          class="q-mr-sm text-capitalize"
          @click="dismiss"
        />
        <q-btn
          unelevated
          :label="pwaStore.isIOS ? 'Come installare' : 'Installa Ora'"
          color="white"
          text-color="primary"
          :icon="pwaStore.isIOS ? 'help_outline' : 'downloading'"
          class="install-btn text-weight-bold q-px-md"
          @click="installApp"
        />
      </template>
    </q-banner>

    <q-dialog v-model="showHelp">
      <q-card style="min-width: 350px" class="q-pa-md">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            {{
              pwaStore.isIOS ? 'Installazione su iPhone/iPad' : "Guida all'installazione Desktop"
            }}
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div v-if="pwaStore.isIOS" class="column q-gutter-md">
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">1</q-avatar>
              <div class="text-body2">
                Tocca l'icona <strong>Condividi</strong> <q-icon name="ios_share" size="xs" /> nella
                barra in basso di Safari.
              </div>
            </div>
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">2</q-avatar>
              <div class="text-body2">
                Scorri verso l'alto e seleziona <strong>"Aggiungi alla schermata Home"</strong>
                <q-icon name="add_box" size="xs" />.
              </div>
            </div>
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">3</q-avatar>
              <div class="text-body2">
                Tocca <strong>"Aggiungi"</strong> in alto a destra per confermare.
              </div>
            </div>
            <q-separator class="q-my-sm" />
            <div class="text-caption text-grey-7 italic">
              L'app apparirà tra le tue icone e potrai usarla a schermo intero senza la barra di
              Safari.
            </div>
          </div>

          <div v-else class="column q-gutter-md">
            <div class="row no-wrap items-center q-gutter-sm">
              <q-avatar color="primary" text-color="white" size="sm">1</q-avatar>
              <div class="text-body2">
                Clicca sul pulsante <strong>"Installa Ora"</strong> nel banner blu.
              </div>
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
                L'app verrà aggiunta al tuo desktop e potrai avviarla come un programma vero e
                proprio.
              </div>
            </div>
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
  background: linear-gradient(135deg, $primary 0%, #0c81cd 100%);
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
  }

  .pwa-premium-banner {
    flex-direction: column;
    align-items: center;
    text-align: center;

    .q-banner__actions {
      margin-top: 12px;
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
