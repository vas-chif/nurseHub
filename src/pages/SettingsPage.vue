/**
 * @file SettingsPage.vue
 * @description User preferences page for managing notifications, language, and navigation visibility.
 * @author Nurse Hub Team
 * @created 2026-03-12
 * @modified 2026-04-27
 * @notes
 * - Integrates with Firebase Messaging (FCM) for push notifications.
 * - Allows admins to customize the bottom navigation bar visibility (Tab-Fencing).
 * - Language selection logic (Italian/English).
 */
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { messaging, db } from '../boot/firebase';
import { getToken, deleteToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { useSecureLogger } from '../utils/secureLogger';

const $q = useQuasar();
const authStore = useAuthStore();
const uiStore = useUiStore();
const logger = useSecureLogger();

const notificationsEnabled = ref(false);
const currentLanguage = ref('Italiano');
const loading = ref(false);

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const enableNotifications = async () => {
  if (!messaging) {
    $q.notify({ type: 'warning', message: 'Notifiche non supportate su questo dispositivo.' });
    notificationsEnabled.value = false;
    return;
  }

  if (!VAPID_KEY) {
    $q.notify({ type: 'warning', message: 'VAPID Key non configurata nel file .env' });
    logger.warn('Missing VITE_FIREBASE_VAPID_KEY');
    notificationsEnabled.value = false;
    return;
  }

  loading.value = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.getRegistration();

      const tokenOptions: {
        vapidKey: string;
        serviceWorkerRegistration?: ServiceWorkerRegistration;
      } = {
        vapidKey: VAPID_KEY,
      };

      if (registration) {
        tokenOptions.serviceWorkerRegistration = registration;
      }

      const token = await getToken(messaging, tokenOptions);

      if (token && authStore.currentUser) {
        const userRef = doc(db, 'users', authStore.currentUser.uid);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
        });

        $q.notify({ type: 'positive', message: 'Notifiche attivate con successo!' });
        logger.info('FCM Token saved for user', { uid: authStore.currentUser.uid });
        notificationsEnabled.value = true;
      } else {
        throw new Error('Impossibile recuperare il token FCM');
      }
    } else {
      notificationsEnabled.value = false;
      $q.notify({ type: 'warning', message: 'Permesso notifiche negato.' });
    }
  } catch (error) {
    logger.error('Error enabling notifications', error);
    $q.notify({ type: 'negative', message: "Errore durante l'attivazione delle notifiche." });
    notificationsEnabled.value = false;
  } finally {
    loading.value = false;
  }
};

const disableNotifications = async () => {
  if (!messaging || !authStore.currentUser) return;

  loading.value = true;
  try {
    if (VAPID_KEY) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const tokenOptions: {
          vapidKey: string;
          serviceWorkerRegistration?: ServiceWorkerRegistration;
        } = {
          vapidKey: VAPID_KEY,
        };

        if (registration) {
          tokenOptions.serviceWorkerRegistration = registration;
        }

        const token = await getToken(messaging, tokenOptions);
        if (token) {
          const userRef = doc(db, 'users', authStore.currentUser.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayRemove(token),
          });
          await deleteToken(messaging);
        }
      } catch (e) {
        logger.warn('Could not retrieve token for deletion', e);
      }
    }

    $q.notify({ type: 'info', message: 'Notifiche disattivate.' });
    notificationsEnabled.value = false;
  } catch (error) {
    logger.error('Error disabling notifications', error);
  } finally {
    loading.value = false;
  }
};

const toggleNotifications = async () => {
  if (notificationsEnabled.value) {
    await enableNotifications();
  } else {
    await disableNotifications();
  }
};

onMounted(() => {
  if ('Notification' in window && Notification.permission === 'granted') {
    notificationsEnabled.value = true;
  }
});

const changeLanguage = () => {
  $q.bottomSheet({
    message: 'Seleziona Lingua',
    actions: [
      {
        label: 'Italiano',
        icon: 'flag',
        id: 'it',
      },
      {
        label: 'English',
        icon: 'outlined_flag',
        id: 'en',
      },
    ],
  }).onOk((action) => {
    currentLanguage.value = action.label;
    $q.notify({
      type: 'info',
      message: `Lingua impostata su: ${action.label}`,
    });
  });
};
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <h1 class="text-h4 q-my-none">Impostazioni</h1>
    </div>

    <q-list bordered separator>
      <q-item-label header>Generale</q-item-label>

      <q-item
        clickable
        v-ripple
        @click="
          notificationsEnabled = !notificationsEnabled;
          toggleNotifications();
        "
      >
        <q-item-section>
          <q-item-label>Notifiche</q-item-label>
          <q-item-label caption>Gestisci le preferenze di notifica</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="notificationsEnabled"
            @update:model-value="toggleNotifications"
            :disable="loading"
          />
        </q-item-section>
      </q-item>

      <q-item clickable v-ripple @click="changeLanguage">
        <q-item-section>
          <q-item-label>Lingua</q-item-label>
          <q-item-label caption>{{ currentLanguage }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="chevron_right" />
        </q-item-section>
      </q-item>

      <template v-if="authStore.isAnyAdmin">
        <q-separator />
        <q-item-label header>Visibilità Navigazione (Bottom Tabs)</q-item-label>

        <!-- Home Tab -->
        <q-item tag="label" v-ripple>
          <q-item-section>
            <q-item-label>Home / Dashboard</q-item-label>
            <q-item-label caption>Mostra tab Home</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              :model-value="uiStore.isTabVisible('home')"
              @update:model-value="(val) => uiStore.toggleTabVisibility('home', val)"
            />
          </q-item-section>
        </q-item>

        <!-- Calendar Tab -->
        <q-item tag="label" v-ripple>
          <q-item-section>
            <q-item-label>Turni / Calendario</q-item-label>
            <q-item-label caption>Mostra tab Turni</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              :model-value="uiStore.isTabVisible('calendar')"
              @update:model-value="(val) => uiStore.toggleTabVisibility('calendar', val)"
            />
          </q-item-section>
        </q-item>

        <!-- New Request (Admin Quick Access) -->
        <q-item tag="label" v-ripple>
          <q-item-section>
            <q-item-label>Nuova Richiesta</q-item-label>
            <q-item-label caption>Accesso rapido inserimento assenze</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              :model-value="uiStore.isTabVisible('new_request')"
              @update:model-value="(val) => uiStore.toggleTabVisibility('new_request', val)"
            />
          </q-item-section>
        </q-item>

        <!-- Requests List -->
        <q-item tag="label" v-ripple>
          <q-item-section>
            <q-item-label>Richieste</q-item-label>
            <q-item-label caption>Gestione assenze e cambi</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              :model-value="uiStore.isTabVisible('admin_requests')"
              @update:model-value="(val) => uiStore.toggleTabVisibility('admin_requests', val)"
            />
          </q-item-section>
        </q-item>

        <!-- Users List -->
        <q-item tag="label" v-ripple>
          <q-item-section>
            <q-item-label>Utenti</q-item-label>
            <q-item-label caption>Anagrafica e reparti</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              :model-value="uiStore.isTabVisible('admin_users')"
              @update:model-value="(val) => uiStore.toggleTabVisibility('admin_users', val)"
            />
          </q-item-section>
        </q-item>

        <!-- Analytics -->
        <q-item tag="label" v-ripple>
          <q-item-section>
            <q-item-label>Stats</q-item-label>
            <q-item-label caption>Analisi e reportistica</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              :model-value="uiStore.isTabVisible('admin_analytics')"
              @update:model-value="(val) => uiStore.toggleTabVisibility('admin_analytics', val)"
            />
          </q-item-section>
        </q-item>

        <!-- Admin / System Config (ONLY SuperAdmin) -->
        <q-item tag="label" v-ripple v-if="authStore.isSuperAdmin">
          <q-item-section>
            <q-item-label>Sistema</q-item-label>
            <q-item-label caption>Configurazione globale e reparti</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              :model-value="uiStore.isTabVisible('admin_system')"
              @update:model-value="(val) => uiStore.toggleTabVisibility('admin_system', val)"
            />
          </q-item-section>
        </q-item>
      </template>

      <q-separator />
      <q-item-label header>Account</q-item-label>

      <q-item
        clickable
        v-ripple
        @click="$router.push({ path: '/profile', query: { mode: 'edit' } })"
      >
        <q-item-section>
          <q-item-label>Profilo</q-item-label>
          <q-item-label caption>Modifica i tuoi dati personali</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="chevron_right" />
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>
