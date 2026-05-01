/**
 * @file configStore.ts
 * @description Pinia store for managing system-wide configurations, department settings, and environment isolation.
 * @author Nurse Hub Team
 * @created 2026-03-05
 * @modified 2026-04-27
 * @notes
 * - Handles the activation/deactivation of hierarchical system configurations.
 * - Implements config-fencing: filters available configurations based on Admin/SuperAdmin managed claims.
 * - Bridges legacy Firestore fields (role) to modern profession-based interfaces.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { SystemConfiguration } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';
import { useAuthStore } from './authStore';

const logger = useSecureLogger();

export const useConfigStore = defineStore('config', () => {
  const authStore = useAuthStore();
  const activeConfig = ref<SystemConfiguration | null>(null);
  const activeConfigId = ref<string | null>(null);
  const allConfigs = ref<SystemConfiguration[]>([]);
  const loading = ref(false);

  /**
   * Filtered list of configurations based on user permissions
   */
  const availableConfigs = computed(() => {
    if (authStore.isSuperAdmin) return allConfigs.value;
    if (authStore.isAdmin) {
      return allConfigs.value.filter((c) => authStore.managedConfigIds.includes(c.id));
    }
    // Standard users only see their own config
    return allConfigs.value.filter((c) => c.id === authStore.currentUser?.configId);
  });

  /**
   * Load all configurations and identify the active one
   */
  async function loadConfigurations() {
    loading.value = true;
    try {
      const snapshot = await getDocs(collection(db, 'systemConfigurations'));
      allConfigs.value = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Map legacy 'role' field from Firestore to 'profession' in interface
          profession: data.profession || data.role || 'Infermiere',
        };
      }) as SystemConfiguration[];

      // Set initial viewing config based on user's primary config or first available
      let defaultViewId = authStore.currentUser?.configId;

      if (!defaultViewId && availableConfigs.value.length > 0) {
        defaultViewId = availableConfigs.value[0]?.id;
      } else if (!defaultViewId && allConfigs.value.length > 0) {
        defaultViewId = allConfigs.value[0]?.id;
      }

      if (defaultViewId) {
        setActiveConfig(defaultViewId);
      }
    } catch (error) {
      logger.error('Failed to load configurations', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Set a configuration as active for the local view (Maestro Filter).
   * Does NOT write to Firestore to avoid affecting other users.
   */
  function setActiveConfig(configId: string) {
    const configToActivate = allConfigs.value.find((c) => c.id === configId);
    if (!configToActivate) {
      logger.warn(`Configuration ${configId} not found`);
      return;
    }

    activeConfig.value = configToActivate;
    activeConfigId.value = configId;
    logger.info('Local viewing context switched', { configId, name: configToActivate.name });
  }

  /**
   * Refresh configurations from Firestore
   */
  async function refreshConfigurations() {
    await loadConfigurations();
  }

  return {
    activeConfig,
    activeConfigId,
    allConfigs,
    availableConfigs,
    loading,
    loadConfigurations,
    setActiveConfig,
    refreshConfigurations,
  };
});
