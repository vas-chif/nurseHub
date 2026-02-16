<template>
  <div class="flex flex-center bg-grey-2" style="min-height: 100vh">
    <q-card class="q-pa-md" style="width: 400px; max-width: 90vw">
      <q-card-section class="text-center">
        <q-icon name="hourglass_empty" size="64px" color="orange" />
        <div class="text-h5 q-mt-md">Account in Verifica</div>
      </q-card-section>

      <q-card-section>
        <p class="text-body1">
          Il tuo account è in attesa di verifica da parte dell'amministratore.
        </p>
        <p class="text-body2 text-grey-7">
          Un amministratore deve collegare il tuo account al profilo operatore esistente. Riceverai
          una notifica via email quando l'account sarà attivato.
        </p>
      </q-card-section>

      <q-card-section v-if="currentUser">
        <q-list bordered separator>
          <q-item>
            <q-item-section>
              <q-item-label caption>Email</q-item-label>
              <q-item-label>{{ currentUser.email }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>Nome</q-item-label>
              <q-item-label>{{ currentUser.firstName }} {{ currentUser.lastName }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>Data Registrazione</q-item-label>
              <q-item-label>{{ formatDate(currentUser.createdAt) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="center">
        <q-btn
          label="Aggiorna"
          icon="refresh"
          color="primary"
          outline
          @click="checkVerificationStatus"
          :loading="checking"
        />
        <q-btn label="Esci" icon="logout" color="negative" outline @click="handleLogout" />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useQuasar } from 'quasar';

const router = useRouter();
const authStore = useAuthStore();
const $q = useQuasar();

const checking = ref(false);
const currentUser = computed(() => authStore.currentUser);

async function checkVerificationStatus() {
  checking.value = true;

  try {
    if (authStore.currentUser) {
      await authStore.loadUserProfile(authStore.currentUser.uid);

      if (authStore.isVerified) {
        $q.notify({
          type: 'positive',
          message: 'Account verificato! Reindirizzamento...',
        });
        void router.push('/');
      } else {
        $q.notify({
          type: 'info',
          message: 'Account ancora in attesa di verifica',
        });
      }
    }
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Errore durante la verifica',
    });
  } finally {
    checking.value = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  void router.push('/login');
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
</script>
