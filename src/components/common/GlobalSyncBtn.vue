/**
 * @file GlobalSyncBtn.vue
 * @description Centralized sync button component with global cooldown logic and premium UI.
 * @author Nurse Hub Team
 * @created 2026-04-20
 * @notes
 * - Shared across Dashboard and Calendar pages.
 * - Handles its own loading state and syncStore interaction.
 * - Respects §1.10 JWT-First and Phase 25 global cooldown.
 */
<template>
  <div class="row items-center no-wrap bg-grey-2 q-px-sm q-py-xs rounded-borders" style="border-radius: 20px;">
    <!-- Visible Cooldown Timer Badge -->
    <transition
      appear
      enter-active-class="animated fadeIn"
      leave-active-class="animated fadeOut"
    >
      <div v-if="!syncStore.canSync && _tick >= 0" class="row items-center q-mr-xs">
        <q-badge
          rounded
          color="orange-2"
          text-color="orange-10"
          :label="syncStore.cooldownLabel"
          class="text-weight-bold"
          style="padding: 2px 8px;"
        />
      </div>
    </transition>

    <q-btn
      flat
      round
      dense
      :size="size"
      :icon="syncing ? 'hourglass_empty' : 'refresh'"
      :color="syncStore.canSync ? 'primary' : 'grey-5'"
      :loading="syncing"
      :disable="!syncStore.canSync"
      @click="handleSync"
      class="transition-button"
    >
      <q-tooltip>
        <span v-if="syncStore.canSync">Sincronizza turni da Google Sheets</span>
        <span v-else>Prossima sincronizzazione tra {{ syncStore.cooldownLabel }}</span>
      </q-tooltip>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useSyncStore } from '../../stores/syncStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { SyncService } from '../../services/SyncService';
import { GoogleSheetsService } from '../../services/GoogleSheetsService';
import { DEFAULT_SHEETS_CONFIG } from '../../config/sheets';
import { useSecureLogger } from '../../utils/secureLogger';

interface Props {
  size?: 'xs' | 'sm' | 'md';
}

withDefaults(defineProps<Props>(), {
  size: 'sm'
});

const logger = useSecureLogger();
const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const syncStore = useSyncStore();
const scheduleStore = useScheduleStore();
const syncing = ref(false);

// Reactive tick for timer re-evaluation
const _tick = ref(0);
let interval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await syncStore.loadSyncStatus();
  interval = setInterval(() => { _tick.value++; }, 1000);
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});

async function handleSync() {
  const configId = authStore.currentUser?.configId || configStore.activeConfigId;
  if (!configId) {
    $q.notify({ type: 'warning', message: 'Configurazione non trovata.' });
    return;
  }

  if (!syncStore.canSync) {
    $q.notify({
      type: 'info',
      message: `Sincronizzazione globale in cooldown. Riprova tra ${syncStore.cooldownLabel}.`,
      timeout: 3000
    });
    return;
  }

  syncing.value = true;
  try {
    const appConfig = {
      ...DEFAULT_SHEETS_CONFIG,
      spreadsheetUrl: configStore.activeConfig?.spreadsheetUrl || DEFAULT_SHEETS_CONFIG.spreadsheetUrl,
    };

    const sheetsService = new GoogleSheetsService(appConfig);
    const svcSync = new SyncService(sheetsService);

    // Phase 25: Full sync for the active configuration
    logger.info('Starting global sync for config', { configId });
    await svcSync.syncOperatorsFromSheets(configId);

    // Record the global sync event
    await syncStore.recordSync();

    $q.notify({
      type: 'positive',
      message: 'Sincronizzazione Google Sheets -> Firebase completata con successo!',
      icon: 'cloud_done',
      timeout: 3000
    });

    // Refresh schedule store data immediately for the current user
    await scheduleStore.loadOperators(configId, true);

  } catch (err) {
    logger.error('GlobalSyncBtn error:', err);
    $q.notify({
      type: 'negative',
      message: 'Errore durante la sincronizzazione globale.'
    });
  } finally {
    syncing.value = false;
  }
}
</script>

<style scoped>
.transition-button {
  transition: transform 0.2s ease;
}
.transition-button:active {
  transform: scale(0.9);
}
</style>
