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
import { isSupported, getToken, deleteToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useConfigStore } from '../stores/configStore';
import { useSecureLogger } from '../utils/secureLogger';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import {
  syncWidgetData,
  clearWidgetData,
  acceptWidgetPrivacy,
  isWidgetPrivacyAccepted,
  isWidgetClickable,
  setWidgetClickable,
} from '../services/WidgetBridgeService';

const $q = useQuasar();
const authStore = useAuthStore();
const uiStore = useUiStore();
const scheduleStore = useScheduleStore();
const configStore = useConfigStore();
const logger = useSecureLogger();

const notificationsEnabled = ref(false);
const currentLanguage = ref('Italiano');
const loading = ref(false);

// Phase 42: Widget home screen state
const widgetEnabled = ref(false);
const widgetPrivacyDialog = ref(false);
const widgetLoading = ref(false);
// Phase 44: Widget clickable toggle (default true → tap opens app)
const widgetClickable = ref(true);

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const enableNotifications = async () => {
  if (Capacitor.isNativePlatform()) {
    loading.value = true;
    try {
      await FirebaseMessaging.requestPermissions();
      const { token } = await FirebaseMessaging.getToken();
      if (token && authStore.currentUser) {
        const userRef = doc(db, 'users', authStore.currentUser.uid);
        await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
        $q.notify({ type: 'positive', message: 'Notifiche attivate con successo!' });
        notificationsEnabled.value = true;
      }
    } catch (e) {
      logger.error('Error enabling native notifications', e);
      $q.notify({ type: 'negative', message: "Errore durante l'attivazione delle notifiche native." });
      notificationsEnabled.value = false;
    } finally {
      loading.value = false;
    }
    return;
  }

  // Web PWA logic — messaging is initialized async; re-check support on demand
  const messagingReady = messaging ?? (await isSupported().then(ok => ok ? messaging : null).catch(() => null));
  if (!messagingReady) {
    $q.notify({
      type: 'warning',
      message: 'Notifiche Web Push non disponibili in questo browser. Usa l\'app nativa per riceverle.',
    });
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

      const token = await getToken(messagingReady, tokenOptions);

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
  if (!authStore.currentUser) return;

  loading.value = true;
  try {
    if (Capacitor.isNativePlatform()) {
      const { token } = await FirebaseMessaging.getToken();
      if (token) {
        const userRef = doc(db, 'users', authStore.currentUser.uid);
        await updateDoc(userRef, { fcmTokens: arrayRemove(token) });
        await FirebaseMessaging.deleteToken();
      }
    } else {
      if (!messaging) return;
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
    } // End of Web PWA logic

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

onMounted(async () => {
  // On native use FCM permission state; on web fall back to Web Notification API
  if (Capacitor.isNativePlatform()) {
    try {
      const { receive } = await FirebaseMessaging.checkPermissions();
      notificationsEnabled.value = receive === 'granted';
    } catch {
      notificationsEnabled.value = false;
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    notificationsEnabled.value = true;
  }
  // Phase 42: restore widget toggle state from stored consent
  widgetEnabled.value = await isWidgetPrivacyAccepted();
  // Phase 44: restore widget clickable preference
  widgetClickable.value = await isWidgetClickable();
});

/**
 * Called when the user toggles the widget clickable switch.
 * Persists the preference and refreshes the widget immediately.
 */
const onWidgetClickableToggle = async (val: boolean) => {
  await setWidgetClickable(val);
}; /*end onWidgetClickableToggle*/

/**
 * Finds the current user's operator record.
 * Loads operators from Firestore if the store is empty (e.g. user went to
 * Settings without visiting CalendarPage first).
 * Falls back to matching by op.id === operatorId when userId is not set.
 */
async function resolveMyOperator() {
  const uid = authStore.currentUser?.uid;
  const operatorId = authStore.currentUser?.operatorId;
  const configId = authStore.currentUser?.configId ?? configStore.activeConfigId;

  if (!uid || !operatorId || !configId) return undefined;

  // Ensure operators are loaded for this config
  if (!scheduleStore.operators.length) {
    await scheduleStore.loadOperators(configId);
  }

  return (
    scheduleStore.operators.find((op) => op.userId === uid) ??
    scheduleStore.operators.find((op) => op.id === operatorId)
  );
} /*end resolveMyOperator*/

/**
 * Called when the user toggles the widget switch.
 * Shows GDPR disclaimer on first activation; clears data on deactivation.
 */
const onWidgetToggle = async (enabled: boolean) => {
  if (enabled) {
    const alreadyAccepted = await isWidgetPrivacyAccepted();
    if (alreadyAccepted) {
      const myOperator = await resolveMyOperator();
      if (myOperator) {
        widgetLoading.value = true;
        await syncWidgetData(myOperator, authStore.currentUser?.firstName ?? '');
        widgetLoading.value = false;
      } else {
        $q.notify({ type: 'warning', message: 'Nessun operatore collegato. Vai al Calendario prima.' });
        widgetEnabled.value = false;
      }
    } else {
      // Must accept disclaimer before activating
      widgetEnabled.value = false;
      widgetPrivacyDialog.value = true;
    }
  } else {
    widgetLoading.value = true;
    await clearWidgetData();
    widgetLoading.value = false;
    $q.notify({ type: 'info', message: 'Dati widget rimossi dalla home screen.' });
  }
}; /*end onWidgetToggle*/

/** User accepted the GDPR disclaimer — persist consent and sync data. */
const onWidgetPrivacyAccept = async () => {
  widgetPrivacyDialog.value = false;
  widgetLoading.value = true;
  try {
    await acceptWidgetPrivacy();
    const myOperator = await resolveMyOperator();
    if (myOperator) {
      await syncWidgetData(myOperator, authStore.currentUser?.firstName ?? '');
    }
    widgetEnabled.value = true;
    $q.notify({
      type: 'positive',
      message: 'Widget attivato! Tieni premuta la home screen → Widgets → NurseHub Turni.',
    });
  } catch (err) {
    logger.error('Widget privacy accept failed', err);
    widgetEnabled.value = false;
  } finally {
    widgetLoading.value = false;
  }
}; /*end onWidgetPrivacyAccept*/

/** User rejected the disclaimer — keep toggle OFF. */
const onWidgetPrivacyReject = () => {
  widgetPrivacyDialog.value = false;
  widgetEnabled.value = false;
}; /*end onWidgetPrivacyReject*/

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

      <q-item tag="label" v-ripple>
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

      <!-- Phase 42: Widget Home Screen section -->
      <q-separator />
      <q-item-label header>Widget Home Screen</q-item-label>

      <q-item v-if="Capacitor.isNativePlatform()" tag="label" v-ripple>
        <q-item-section>
          <q-item-label>Mostra turni nel widget</q-item-label>
          <q-item-label caption>
            La griglia turni mensile sarà visibile nella home screen
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="widgetEnabled"
            :disable="widgetLoading"
            color="primary"
            @update:model-value="onWidgetToggle"
          />
        </q-item-section>
      </q-item>

      <!-- Phase 44: Widget clickable toggle — always visible on native -->
      <q-item v-if="Capacitor.isNativePlatform()" tag="label" v-ripple>
        <q-item-section>
          <q-item-label>Widget cliccabile</q-item-label>
          <q-item-label caption>
            Toccare il widget apre l'app. Disattiva per visualizzazione sola.
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="widgetClickable"
            color="primary"
            @update:model-value="onWidgetClickableToggle"
          />
        </q-item-section>
      </q-item>

      <q-item v-if="!Capacitor.isNativePlatform()">
        <q-item-section>
          <q-item-label>Widget Home Screen</q-item-label>
          <q-item-label caption>
            Disponibile solo nell'app nativa Android
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="widgets" color="grey-5" />
        </q-item-section>
      </q-item>

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

    <!-- Phase 42: Widget GDPR Privacy Disclaimer (§1.5 GDPR Art.30) -->
    <q-dialog v-model="widgetPrivacyDialog" persistent>
      <q-card style="max-width: 400px; width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <q-icon name="widgets" color="primary" size="28px" class="q-mr-sm" />
          <span class="text-h6">Widget Turni — Privacy</span>
        </q-card-section>

        <q-card-section class="q-pt-md">
          <p class="text-body2 q-mb-sm">
            Attivando il widget, i tuoi <strong>turni mensili</strong> verranno
            salvati nella memoria locale del dispositivo e mostrati
            <strong>nella home screen</strong>.
          </p>
          <p class="text-body2 q-mb-sm">
            Chiunque abbia accesso al tuo telefono potrà vedere i tuoi turni
            senza aprire l'app.
          </p>
          <p class="text-caption text-grey-7 q-mb-none">
            I dati sono archiviati esclusivamente sul dispositivo e non
            vengono trasmessi a terzi. Puoi rimuoverli in qualsiasi momento
            disattivando questo toggle. (GDPR Art. 5 – principio di minimizzazione)
          </p>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn
            flat
            label="Annulla"
            color="grey-7"
            @click="onWidgetPrivacyReject"
          />
          <q-btn
            unelevated
            label="Accetto"
            color="primary"
            :loading="widgetLoading"
            @click="onWidgetPrivacyAccept"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
