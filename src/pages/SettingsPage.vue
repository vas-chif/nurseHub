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

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { messaging, db } from '../boot/firebase';
import { getToken, deleteToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { useSecureLogger } from '../utils/secureLogger';

const $q = useQuasar();
const authStore = useAuthStore();
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

      // If no registration is found and we are in dev/browser, this might still fail,
      // but passing the active registration fixes the PWA mismatch issue.
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
        // Save token to user profile
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
