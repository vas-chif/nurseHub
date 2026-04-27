/**
 * @file AdminPage.vue
 * @description Administrative entry point for system configuration.
 * @author Nurse Hub Team
 * @created 2026-03-25
 * @modified 2026-04-27
 * @notes
 * - Restricted to SuperAdmins only.
 * - Hosts the SystemConfig component for global settings and backups.
 */
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useQuasar } from 'quasar';
import SystemConfig from '../components/admin/SystemConfig.vue';

const router = useRouter();
const authStore = useAuthStore();
const $q = useQuasar();

onMounted(() => {
  if (!authStore.isSuperAdmin) {
    $q.notify({
      type: 'negative',
      message: 'Accesso negato',
      caption: 'Solo i SuperAdmin possono accedere a questa pagina.'
    });
    void router.push('/');
  }
});
</script>
<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Amministrazione</div>

    <div class="row q-col-gutter-md">
      <div class="col-12">
        <SystemConfig />
      </div>
    </div>
  </q-page>
</template>
