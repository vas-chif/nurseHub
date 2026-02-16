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
          <q-toggle v-model="notificationsEnabled" @update:model-value="toggleNotifications" />
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
import { ref } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();

const notificationsEnabled = ref(true);
const currentLanguage = ref('Italiano');

const toggleNotifications = () => {
  $q.notify({
    type: notificationsEnabled.value ? 'positive' : 'warning',
    message: `Notifiche ${notificationsEnabled.value ? 'abilitate' : 'disabilitate'}`,
  });
};

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
