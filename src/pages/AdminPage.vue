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
