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
import { ref, computed } from 'vue';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useAuthStore } from './authStore';
import { useSecureLogger } from '../utils/secureLogger';
import type { SyncStatus } from '../types/models';

const logger = useSecureLogger();

const ADMIN_COOLDOWN_MS = 60 * 1000; // 1 minute
const USER_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const FIRESTORE_DOC = 'system/syncStatus';

export const useSyncStore = defineStore('sync', () => {
  const lastSyncTimestamp = ref<number | null>(null);
  const lastSyncByName = ref<string>('');
  const loading = ref(false);

  // -- Computed --

  const cooldownMs = computed(() => {
    const authStore = useAuthStore();
    return authStore.isAdmin ? ADMIN_COOLDOWN_MS : USER_COOLDOWN_MS;
  });

  const msUntilNextSync = computed(() => {
    if (lastSyncTimestamp.value === null) return 0;
    const elapsed = Date.now() - lastSyncTimestamp.value;
    return Math.max(0, cooldownMs.value - elapsed);
  });

  const canSync = computed(() => msUntilNextSync.value === 0);

  const cooldownLabel = computed(() => {
    const ms = msUntilNextSync.value;
    if (ms === 0) return '';
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  });

  // -- Actions --

  /**
   * Loads the global sync status from Firestore.
   * Called once on mount to initialize state.
   */
  async function loadSyncStatus(): Promise<void> {
    try {
      const snap = await getDoc(doc(db, FIRESTORE_DOC));
      if (snap.exists()) {
        const data = snap.data() as SyncStatus;
        lastSyncTimestamp.value = data.lastSyncTimestamp;
        lastSyncByName.value = data.lastSyncByName;
        logger.info('SyncStatus loaded', { lastSyncTimestamp: data.lastSyncTimestamp });
      }
    } catch (err) {
      logger.error('Failed to load sync status', err);
    }
  }

  /**
   * Persists the sync status to Firestore after a successful sync.
   */
  async function recordSync(): Promise<void> {
    const authStore = useAuthStore();
    const now = Date.now();
    const displayName =
      `${authStore.currentUser?.firstName ?? ''} ${authStore.currentUser?.lastName ?? ''}`.trim() ||
      'Utente';

    try {
      await setDoc(doc(db, FIRESTORE_DOC), {
        lastSyncTimestamp: now,
        lastSyncByUid: authStore.currentUser?.uid ?? 'unknown',
        lastSyncByName: displayName,
      } satisfies SyncStatus);

      // Update local state immediately (no need to re-read Firestore)
      lastSyncTimestamp.value = now;
      lastSyncByName.value = displayName;
      logger.info('Sync status recorded', { triggeredBy: displayName });
    } catch (err) {
      logger.error('Failed to record sync status', err);
    }
  }

  return {
    lastSyncTimestamp,
    lastSyncByName,
    loading,
    canSync,
    msUntilNextSync,
    cooldownLabel,
    loadSyncStatus,
    recordSync,
  };
});
