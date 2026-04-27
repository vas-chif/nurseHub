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

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useSyncStore } from '../../stores/syncStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { SyncService } from '../../services/SyncService';
import { GoogleSheetsService } from '../../services/GoogleSheetsService';
import { DEFAULT_SHEETS_CONFIG } from '../../config/sheets';
import { useSecureLogger } from '../../utils/secureLogger';
import type { SystemConfiguration } from '../../types/models';

interface Props {
  size?: 'xs' | 'sm' | 'md';
  targetConfig?: SystemConfiguration; // NEW: Optional targeted config
  showLabel?: boolean; // NEW: Optional label
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  showLabel: false
});

const logger = useSecureLogger();
const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const syncStore = useSyncStore();
const scheduleStore = useScheduleStore();
const syncing = ref(false);

const canSync = computed(() => {
  const configId = props.targetConfig?.id || configStore.activeConfigId || authStore.currentUser?.configId;
  return configId ? syncStore.canSync(configId) : false;
});

const cooldownLabel = computed(() => {
  const configId = props.targetConfig?.id || configStore.activeConfigId || authStore.currentUser?.configId;
  return configId ? syncStore.getCooldownLabel(configId) : '';
});

onMounted(async () => {
  const configId = props.targetConfig?.id || configStore.activeConfigId || authStore.currentUser?.configId;
  if (configId) await syncStore.loadSyncStatus(configId);
});

onUnmounted(() => {
});

async function handleSync() {
  // Use targetConfig ID or fallback to current user/active config
  const configId = props.targetConfig?.id || configStore.activeConfigId || authStore.currentUser?.configId;

  if (!configId) {
    $q.notify({ type: 'warning', message: 'Configurazione non trovata.' });
    return;
  }

  if (!syncStore.canSync(configId)) {
    $q.notify({
      type: 'info',
      message: `Sincronizzazione per questo reparto in cooldown. Riprova tra ${syncStore.getCooldownLabel(configId)}.`,
      timeout: 3000
    });
    return;
  }

  syncing.value = true;
  try {
    // 1. Prepare configuration parameters
    const spreadsheetUrl = props.targetConfig?.spreadsheetUrl || configStore.activeConfig?.spreadsheetUrl || DEFAULT_SHEETS_CONFIG.spreadsheetUrl;
    const gasWebUrl = props.targetConfig?.gasWebUrl || configStore.activeConfig?.gasWebUrl;

    const appConfig = {
      ...DEFAULT_SHEETS_CONFIG,
      spreadsheetUrl,
      gasWebUrl: gasWebUrl || undefined
    };

    const sheetsService = new GoogleSheetsService(appConfig);
    const svcSync = new SyncService(sheetsService);

    // Phase 25: Full sync for the targeted configuration
    logger.info('Starting sync for config', { configId, name: props.targetConfig?.name || 'Active' });
    await svcSync.syncOperatorsFromSheets(configId);

    // Record the global sync event
    await syncStore.recordSync(configId);

    $q.notify({
      type: 'positive',
      message: props.targetConfig
        ? `Sincronizzazione per "${props.targetConfig.name}" completata!`
        : 'Sincronizzazione Google Sheets -> Firebase completata con successo!',
      icon: 'cloud_done',
      timeout: 3000
    });

    // Refresh schedule store data immediately if this was the active config
    if (configId === configStore.activeConfigId) {
      await scheduleStore.loadOperators(configId, true);
    }

  } catch (err) {
    logger.error('GlobalSyncBtn error:', err);
    $q.notify({
      type: 'negative',
      message: 'Errore durante la sincronizzazione.'
    });
  } finally {
    syncing.value = false;
  }
}
</script>
<template>
  <div class="row items-center no-wrap bg-grey-2 q-px-sm q-py-xs rounded-borders" style="border-radius: 20px;">
    <!-- Visible Cooldown Timer Badge -->
    <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="!canSync" class="row items-center q-mr-xs">
        <q-badge rounded color="orange-2" text-color="orange-10" :label="cooldownLabel" class="text-weight-bold"
          style="padding: 2px 8px;" />
      </div>
    </transition>

    <q-btn flat round dense :size="size" :icon="syncing ? 'hourglass_empty' : 'refresh'"
      :color="canSync ? 'primary' : 'grey-5'" :loading="syncing" :disable="!canSync" @click="handleSync"
      class="transition-button">
      <span v-if="showLabel" class="q-ml-xs text-caption text-weight-bold">Sincronizza Ora</span>
      <q-tooltip>
        <span v-if="canSync">Sincronizza turni da Google Sheets</span>
        <span v-else>Prossima sincronizzazione tra {{ cooldownLabel }}</span>
      </q-tooltip>
    </q-btn>
  </div>
</template>

<style scoped>
.transition-button {
  transition: transform 0.2s ease;
}

.transition-button:active {
  transform: scale(0.9);
}
</style>
