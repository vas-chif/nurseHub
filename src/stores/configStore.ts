import { defineStore } from 'pinia';
import { ref } from 'vue';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { SystemConfiguration } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

export const useConfigStore = defineStore('config', () => {
  const activeConfig = ref<SystemConfiguration | null>(null);
  const activeConfigId = ref<string | null>(null);
  const allConfigs = ref<SystemConfiguration[]>([]);
  const loading = ref(false);

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

      // Find active config
      const active = allConfigs.value.find((c) => c.isActive);
      if (active) {
        activeConfig.value = active;
        activeConfigId.value = active.id;
        logger.info('Active configuration loaded', { configId: active.id, name: active.name });
      } else if (allConfigs.value.length > 0) {
        // If no active config, activate the first one
        const firstConfig = allConfigs.value[0];
        if (firstConfig?.id) {
          await setActiveConfig(firstConfig.id);
        }
      }
    } catch (error) {
      logger.error('Failed to load configurations', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Set a configuration as active (and deactivate all others)
   */
  async function setActiveConfig(configId: string) {
    loading.value = true;
    try {
      // Find the config to activate
      const configToActivate = allConfigs.value.find((c) => c.id === configId);
      if (!configToActivate) {
        throw new Error(`Configuration ${configId} not found`);
      }

      // Deactivate all configs
      for (const config of allConfigs.value) {
        if (config.isActive) {
          const configRef = doc(db, 'systemConfigurations', config.id);
          await updateDoc(configRef, { isActive: false });
          config.isActive = false;
        }
      }

      // Activate selected config
      const configRef = doc(db, 'systemConfigurations', configId);
      await updateDoc(configRef, { isActive: true });
      configToActivate.isActive = true;

      // Update store
      activeConfig.value = configToActivate;
      activeConfigId.value = configId;

      logger.info('Configuration activated', { configId, name: configToActivate.name });
    } catch (error) {
      logger.error('Failed to set active configuration', error);
      throw error;
    } finally {
      loading.value = false;
    }
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
    loading,
    loadConfigurations,
    setActiveConfig,
    refreshConfigurations,
  };
});
