<template>
  <q-card class="sync-operator-card">
    <q-card-section>
      <div class="text-h6">🔄 Sincronizza Operatore</div>
      <div class="text-caption text-grey-7">
        Clicca il bottone per cercare il tuo profilo operatore nel sistema
      </div>
    </q-card-section>

    <q-card-section v-if="syncResult">
      <q-banner :class="syncResult.success ? 'bg-positive' : 'bg-warning'" rounded>
        <template v-slot:avatar>
          <q-icon
            :name="syncResult.success ? 'check_circle' : 'info'"
            :color="syncResult.success ? 'white' : 'orange-9'"
          />
        </template>
        <div :class="syncResult.success ? 'text-white' : 'text-orange-9'">
          {{ syncResult.message }}
        </div>
      </q-banner>
    </q-card-section>

    <q-card-actions align="center">
      <q-btn
        unelevated
        color="primary"
        label="Trova associazione operatore"
        icon="search"
        :loading="loading"
        :disable="loading || (syncResult?.success ?? false)"
        @click="handleSync"
      />
    </q-card-actions>

    <q-card-section v-if="!syncResult && !loading" class="text-caption text-grey-6 text-center">
      Se non trovi il tuo operatore, attendi l'approvazione dell'amministratore
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { userService } from '../../services/UserService';
import { useAuthStore } from '../../stores/authStore';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const $q = useQuasar();
const router = useRouter();

const loading = ref(false);
const syncResult = ref<{
  success: boolean;
  message: string;
} | null>(null);

async function handleSync() {
  if (!authStore.currentUser?.uid) {
    $q.notify({
      type: 'negative',
      message: 'Utente non autenticato',
      position: 'top',
    });
    return;
  }

  loading.value = true;
  syncResult.value = null;

  try {
    const result = await userService.syncUserToOperator(authStore.currentUser.uid);

    syncResult.value = {
      success: result.success,
      message: result.message,
    };

    if (result.success) {
      // Reload user profile to get updated data
      await authStore.loadUserProfile(authStore.currentUser.uid);

      setTimeout(() => {
        void router.push('/');
      }, 2000);
    }
  } catch (error) {
    const err = error as { message?: string };
    syncResult.value = {
      success: false,
      message: `Errore: ${err.message || 'Errore sconosciuto'}`,
    };
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.sync-operator-card {
  max-width: 500px;
  margin: 0 auto;
}
</style>
