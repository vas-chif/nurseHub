/**
 * @file configStore.ts
 * @description Pinia store for managing system-wide configurations, department settings, and environment isolation.
 * @author Nurse Hub Team
 * @created 2026-03-05
 * @modified 2026-05-14
 * @notes
 * - Phase 38: activeGroupName + setActiveGroup for cascading Group→Config navigation (RAM-only, no extra Firebase reads)
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
const LAST_CONFIG_KEY = 'nursehub_active_config_id';

export const useConfigStore = defineStore('config', () => {
  const authStore = useAuthStore();
  const activeConfig = ref<SystemConfiguration | null>(null);
  const activeConfigId = ref<string | null>(null);
  const activeGroupName = ref<string | null>(null);
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
   * Configs filtered to the active group (Phase 38). Falls back to all available configs
   * when no group is selected — zero extra Firebase reads, pure RAM filter.
   */
  const configsInActiveGroup = computed<SystemConfiguration[]>(() => {
    if (!activeGroupName.value) return availableConfigs.value;
    return availableConfigs.value.filter((c) => {
      if (activeGroupName.value === 'Altre Configurazioni') return !c.group;
      return c.group === activeGroupName.value;
    });
  });

  /**
   * Unique group names from availableConfigs — used for Cartelle comboboxes (Phase 37).
   * Includes "Altre Configurazioni" if there are configs without a group.
   */
  const groupOptions = computed<string[]>(() => {
    const groups = new Set<string>();
    let hasNullGroup = false;
    availableConfigs.value.forEach((c) => {
      if (c.group) {
        groups.add(c.group);
      } else {
        hasNullGroup = true;
      }
    });
    const result = Array.from(groups).sort();
    if (hasNullGroup) result.push('Altre Configurazioni');
    return result;
  });

  /**
   * Selects a group and auto-switches activeConfigId to the first config in that group
   * if the current active config does not already belong to it. Pass null to clear
   * the group filter and restore the full available list.
   */
  function setActiveGroup(group: string | null) {
    activeGroupName.value = group;
    if (!group) return;
    // Keep current config if it already belongs to the selected group
    const alreadyInGroup = configsInActiveGroup.value.some((c) => c.id === activeConfigId.value);
    if (!alreadyInGroup && configsInActiveGroup.value.length > 0) {
      setActiveConfig(configsInActiveGroup.value[0]!.id);
    }
  }

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

      // 1. Identify potential default (user's primary config)
      let targetId = authStore.currentUser?.configId;

      // 2. If SuperAdmin or Admin with multiple options, try to restore from localStorage
      if (authStore.isSuperAdmin || (authStore.isAdmin && authStore.managedConfigIds.length > 1)) {
        const savedId = localStorage.getItem(LAST_CONFIG_KEY);
        if (savedId) {
          // Verify if the savedId is still valid for this user
          const isAvailable = availableConfigs.value.some((c) => c.id === savedId);
          if (isAvailable) {
            targetId = savedId;
            logger.info('Restored last active configuration from storage', { targetId });
          }
        }
      }

      // 3. Fallback: if no valid ID yet, use the first available config
      if (!targetId && availableConfigs.value.length > 0) {
        targetId = availableConfigs.value[0]?.id;
      }

      if (targetId) {
        setActiveConfig(targetId);
      }
    } catch (err) {
      logger.error('Failed to load configurations', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Switches the active configuration context
   */
  function setActiveConfig(configId: string) {
    const configToActivate = allConfigs.value.find((c) => c.id === configId);
    if (!configToActivate) {
      logger.warn(`Configuration ${configId} not found`);
      return;
    }

    activeConfig.value = configToActivate;
    activeConfigId.value = configId;

    // Persist only if user has multiple choices (SuperAdmin or Multi-department Admin)
    if (authStore.isSuperAdmin || (authStore.isAdmin && authStore.managedConfigIds.length > 1)) {
      localStorage.setItem(LAST_CONFIG_KEY, configId);
    }

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
    activeGroupName,
    allConfigs,
    availableConfigs,
    configsInActiveGroup,
    groupOptions,
    loading,
    loadConfigurations,
    setActiveConfig,
    setActiveGroup,
    refreshConfigurations,
  };
});
