/**
 * @file syncStore.ts
 * @description Pinia store for managing the global sync cooldown with Firestore persistence.
 * @author Nurse Hub Team
 * @created 2026-04-20
 * @modified 2026-04-20
 * @notes
 * - Admin cooldown: 1 minute
 * - User cooldown: 2 hours (shared globally across all users via Firestore)
 * - Single source of truth: Firestore document system/syncStatus
 * @dependencies
 * - firebase/firestore
 * - src/stores/authStore.ts
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useAuthStore } from './authStore';
import { useScheduleStore } from './scheduleStore';
import { useSecureLogger } from '../utils/secureLogger';
import type { SyncStatus } from '../types/models';

const logger = useSecureLogger();

const ADMIN_COOLDOWN_MS = 60 * 1000; // 1 minute
const USER_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

export const useSyncStore = defineStore('sync', () => {
  // Map of configId -> lastSyncTimestamp
  const syncTimestamps = ref<Record<string, number | null>>({});
  // Map of configId -> lastSyncByName
  const syncAuthors = ref<Record<string, string>>({});
  
  const loading = ref(false);
  const currentTime = ref(Date.now());

  // Update current time every second to drive computed reactivity
  setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);

  // -- Helpers --

  const getSyncDocPath = (configId: string) => `systemConfigurations/${configId}/metadata/sync`;

  // -- Getters (Factory functions since they need configId) --

  const getMsUntilNextSync = (configId: string) => {
    const authStore = useAuthStore();
    const lastSync = syncTimestamps.value[configId];
    if (lastSync === undefined || lastSync === null) return 0;
    
    const cooldown = authStore.isAdmin ? ADMIN_COOLDOWN_MS : USER_COOLDOWN_MS;
    const elapsed = currentTime.value - lastSync;
    return Math.max(0, cooldown - elapsed);
  };

  const canSync = (configId: string) => getMsUntilNextSync(configId) === 0;

  const getCooldownLabel = (configId: string) => {
    const ms = getMsUntilNextSync(configId);
    if (ms === 0) return '';
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  // -- Actions --

  /**
   * Loads the sync status for a specific config from Firestore.
   */
  async function loadSyncStatus(configId: string): Promise<void> {
    if (!configId) return;
    try {
      const snap = await getDoc(doc(db, getSyncDocPath(configId)));
      if (snap.exists()) {
        const data = snap.data() as SyncStatus;
        syncTimestamps.value[configId] = data.lastSyncTimestamp;
        syncAuthors.value[configId] = data.lastSyncByName;
        logger.debug(`SyncStatus loaded for ${configId}`, { lastSyncTimestamp: data.lastSyncTimestamp });
      } else {
        // Initialize if not exists
        syncTimestamps.value[configId] = null;
        syncAuthors.value[configId] = '';
      }
    } catch (err) {
      logger.error(`Failed to load sync status for ${configId}`, err);
    }
  }

  /**
   * Persists the sync status to Firestore after a successful sync for a config.
   */
  async function recordSync(configId: string): Promise<void> {
    if (!configId) return;
    const authStore = useAuthStore();
    const now = Date.now();
    const displayName =
      `${authStore.currentUser?.firstName ?? ''} ${authStore.currentUser?.lastName ?? ''}`.trim() ||
      'Utente';

    try {
      await setDoc(doc(db, getSyncDocPath(configId)), {
        lastSyncTimestamp: now,
        lastSyncByUid: authStore.currentUser?.uid ?? 'unknown',
        lastSyncByName: displayName,
      } satisfies SyncStatus);

      // Update local state immediately
      syncTimestamps.value[configId] = now;
      syncAuthors.value[configId] = displayName;
      logger.info(`Sync status recorded for ${configId}`, { triggeredBy: displayName });
    } catch (err) {
      logger.error(`Failed to record sync status for ${configId}`, err);
    }
  }

  /**
   * Compares sync status with local store age and forces refresh if needed.
   */
  async function checkAndRefresh(configId: string): Promise<void> {
    if (!configId) return;
    const scheduleStore = useScheduleStore();

    await loadSyncStatus(configId);

    const lastGlobal = syncTimestamps.value[configId];
    if (lastGlobal && scheduleStore.lastUpdated) {
      if (lastGlobal > scheduleStore.lastUpdated) {
        logger.info(`New sync detected for ${configId}, refreshing local data...`, {
          global: lastGlobal,
          local: scheduleStore.lastUpdated,
        });
        await scheduleStore.loadOperators(configId, true);
      }
    }
  }

  return {
    syncTimestamps,
    syncAuthors,
    loading,
    currentTime,
    canSync,
    getMsUntilNextSync,
    getCooldownLabel,
    loadSyncStatus,
    recordSync,
    checkAndRefresh,
  };
});
