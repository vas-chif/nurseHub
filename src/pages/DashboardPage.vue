<!--
/**
 * @file DashboardPage.vue
 * @description Main dashboard for authenticated users: shift calendar, active requests, swap opportunities.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-04-20
 * @notes
 * - Phase 25: Manual sync button now available for all users (not just admin).
 * - Admin cooldown: 1 min | User cooldown: 2 hours (shared globally via Firestore syncStatus doc).
 * - Background sync fires on app visibility change.
 * @dependencies
 * - src/stores/syncStore.ts
 * - src/services/SyncService.ts
 */
-->
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useQuasar, AppVisibility } from 'quasar';
import ShiftCalendar from '../components/dashboard/ShiftCalendar.vue';
import ActiveRequestsCard from '../components/dashboard/ActiveRequestsCard.vue';
import SwapOpportunitiesCard from '../components/dashboard/SwapOpportunitiesCard.vue';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { useSyncStore } from '../stores/syncStore';
import { SyncService } from '../services/SyncService';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { DEFAULT_SHEETS_CONFIG } from '../config/sheets';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();
const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const syncStore = useSyncStore();
const syncing = ref(false);

// Countdown ticker to keep the UI label reactive
let countdownInterval: ReturnType<typeof setInterval> | null = null;
const countdownTick = ref(0); // incremented every second to force computed re-eval

onMounted(async () => {
  await syncStore.loadSyncStatus();
  // Start a ticker every second so cooldownLabel stays live in the UI
  countdownInterval = setInterval(() => {
    countdownTick.value++;
  }, 1000);
});

// Cleanup on unmount
import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval);
});

async function syncMyShifts() {
  if (!authStore.currentUser?.operatorId || !authStore.currentUser?.configId) {
    $q.notify({ type: 'warning', message: 'Profilo non ancora collegato a un operatore.' });
    return;
  }

  if (!syncStore.canSync) {
    $q.notify({
      type: 'info',
      message: `Sincronizzazione recente. Riprova tra ${syncStore.cooldownLabel}.`,
      timeout: 3000,
    });
    return;
  }

  syncing.value = true;
  try {
    const appConfig = {
      ...DEFAULT_SHEETS_CONFIG,
      spreadsheetUrl:
        configStore.activeConfig?.spreadsheetUrl || DEFAULT_SHEETS_CONFIG.spreadsheetUrl,
    };

    const sheetsService = new GoogleSheetsService(appConfig);
    const svcSync = new SyncService(sheetsService);

    await svcSync.syncIndividualOperator(
      authStore.currentUser.configId,
      authStore.currentUser.operatorId,
    );

    // Record the sync globally on Firestore
    await syncStore.recordSync();

    $q.notify({
      type: 'positive',
      message: 'Turni sincronizzati con Google Sheets!',
      timeout: 2500,
    });
  } catch (err) {
    logger.error('Error syncing shifts:', err);
    $q.notify({
      type: 'negative',
      message: "Errore durante la sincronizzazione dei turni.",
    });
  } finally {
    syncing.value = false;
  }
}

// Background sync when app returns to foreground (respects the same cooldown)
watch(
  () => AppVisibility.appVisible,
  (isVisible) => {
    if (isVisible && authStore.isAuthenticated && authStore.currentUser?.operatorId && syncStore.canSync) {
      logger.info('App returned to focus — triggering background sync...');
      void syncMyShifts();
    }
  },
);
</script>

<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold text-primary">Dashboard</div>

      <!-- Sync button: visible to all users -->
      <div class="row items-center q-gutter-xs">
        <!-- Cooldown badge -->
        <q-badge
          v-if="!syncStore.canSync"
          color="grey-5"
          :label="`⏳ ${syncStore.cooldownLabel}`"
          class="q-mr-xs"
        />

        <q-btn
          flat
          round
          color="primary"
          icon="refresh"
          :loading="syncing"
          :disable="!syncStore.canSync"
          @click="syncMyShifts"
        >
          <q-tooltip>
            <span v-if="syncStore.canSync">Sincronizza i tuoi turni da Google Sheets</span>
            <span v-else>Prossima sincronizzazione tra {{ syncStore.cooldownLabel }}</span>
          </q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Last sync info -->
    <div
      v-if="syncStore.lastSyncTimestamp"
      class="text-caption text-grey-6 q-mb-sm"
    >
      Ultima sincronizzazione: {{ new Date(syncStore.lastSyncTimestamp).toLocaleString('it-IT') }}
      <span v-if="syncStore.lastSyncByName"> — da <strong>{{ syncStore.lastSyncByName }}</strong></span>
    </div>

    <!-- Shift Calendar -->
    <ShiftCalendar />

    <!-- Active Requests -->
    <ActiveRequestsCard />

    <!-- Swap Opportunities -->
    <SwapOpportunitiesCard v-if="authStore.currentOperator" />

    <!-- Quick Actions -->
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
