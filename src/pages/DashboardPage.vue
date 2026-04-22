/**
 * @file DashboardPage.vue
 * @description Main dashboard for authenticated users: shift calendar, active requests, swap opportunities.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-04-20
 */
<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold text-primary">Dashboard</div>
      
      <!-- Componente Centralizzato Sincronizzazione -->
      <GlobalSyncBtn size="sm" />
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

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { AppVisibility } from 'quasar';
import ShiftCalendar from '../components/dashboard/ShiftCalendar.vue';
import ActiveRequestsCard from '../components/dashboard/ActiveRequestsCard.vue';
import SwapOpportunitiesCard from '../components/dashboard/SwapOpportunitiesCard.vue';
import GlobalSyncBtn from '../components/common/GlobalSyncBtn.vue';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();
const authStore = useAuthStore();
const syncStore = useSyncStore();

onMounted(async () => {
  await syncStore.loadSyncStatus();
});

// Background sync on app focus (respects global cooldown)
watch(
  () => AppVisibility.appVisible,
  (isVisible) => {
    if (isVisible && authStore.isAuthenticated) {
      logger.info('App returned to focus — checking for global sync updates');
      void syncStore.checkAndRefresh();
    }
  },
);
</script>
