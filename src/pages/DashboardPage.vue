<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold text-primary">Dashboard</div>
      <div>
        <q-btn flat round color="primary" icon="refresh" :loading="syncing" @click="syncMyShifts">
          <q-tooltip>Aggiorna i tuoi turni da Excel</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Shift Calendar -->
    <ShiftCalendar />

    <!-- Active Requests -->
    <ActiveRequestsCard />

    <!-- Quick Actions (Optional Future) -->
    <div class="q-mt-lg text-center">
      <q-btn
        outline
        color="primary"
        label="Vedi tutto il calendario"
        to="/calendar"
        class="full-width"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useQuasar, AppVisibility } from 'quasar';
import ShiftCalendar from '../components/dashboard/ShiftCalendar.vue';
import ActiveRequestsCard from '../components/dashboard/ActiveRequestsCard.vue';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { SyncService } from '../services/SyncService';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { DEFAULT_SHEETS_CONFIG } from '../config/sheets';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();
const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const syncing = ref(false);

async function syncMyShifts() {
  if (!authStore.currentUser?.operatorId || !authStore.currentUser?.configId) return;

  syncing.value = true;
  try {
    const appConfig = {
      ...DEFAULT_SHEETS_CONFIG,
      spreadsheetUrl:
        configStore.activeConfig?.spreadsheetUrl || DEFAULT_SHEETS_CONFIG.spreadsheetUrl,
    };

    const sheetsService = new GoogleSheetsService(appConfig);
    const syncService = new SyncService(sheetsService);

    await syncService.syncIndividualOperator(
      authStore.currentUser.configId,
      authStore.currentUser.operatorId,
    );

    $q.notify({
      type: 'positive',
      message: 'Turni aggiornati da Excel',
      timeout: 2000,
    });
  } catch (err) {
    logger.error('Error syncing shifts:', err);
    $q.notify({
      type: 'negative',
      message: "Errore durante l'aggiornamento turni",
    });
  } finally {
    syncing.value = false;
  }
}

// Option B: Background Sync on App Focus/Resume
onMounted(() => {
  // Initial sync might already be handled by authStore.loadUserProfile
  // but we can trigger one if needed or just wait for next focus
});

watch(
  () => AppVisibility.appVisible,
  (isVisible) => {
    if (isVisible && authStore.isAuthenticated && authStore.currentUser?.operatorId) {
      logger.info('App returned to focus, triggering background sync...');
      void syncMyShifts();
    }
  },
);
</script>
