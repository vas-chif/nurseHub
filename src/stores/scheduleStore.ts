/**
 * @file scheduleStore.ts
 * @description Pinia store for caching and managing operator schedules with persistence
 * @author Nurse Hub Team
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Operator } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';
import { operatorsService } from '../services/OperatorsService';

const logger = useSecureLogger();
const CACHE_KEY = 'nurseHub_operators';
const CACHE_TS_KEY = 'nurseHub_operators_timestamp';
const CACHE_CONFIG_KEY = 'nurseHub_operators_config';

export const useScheduleStore = defineStore('schedule', () => {
  // State
  const operators = ref<Operator[]>([]);
  const lastUpdated = ref<number | null>(null);
  const activeConfigId = ref<string | null>(null);
  const loading = ref(false);

  // Computed
  const hasData = computed(() => operators.value.length > 0);

  // Actions

  /**
   * Rehydrates store from localStorage on app launch
   */
  function init() {
    try {
      const savedOps = localStorage.getItem(CACHE_KEY);
      const savedTs = localStorage.getItem(CACHE_TS_KEY);
      const savedConfig = localStorage.getItem(CACHE_CONFIG_KEY);

      if (savedOps && savedTs && savedConfig) {
        operators.value = JSON.parse(savedOps);
        lastUpdated.value = parseInt(savedTs);
        activeConfigId.value = savedConfig;
        logger.info('Schedule store rehydrated from cache', {
          count: operators.value.length,
          configId: savedConfig,
        });
      }
    } catch (err) {
      logger.error('Failed to rehydrate schedule store', err);
      clearCache();
    }
  }

  /**
   * Updates state and persists to localStorage
   */
  function setOperators(data: Operator[], configId: string) {
    operators.value = data;
    activeConfigId.value = configId;
    lastUpdated.value = Date.now();

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TS_KEY, lastUpdated.value.toString());
      localStorage.setItem(CACHE_CONFIG_KEY, configId);
    } catch (err) {
      logger.error('Failed to persist operators to localStorage', err);
    }
  }

  /**
   * Fetches operators from service, using cache if available and not forced
   */
  async function loadOperators(configId: string, forceRefresh = false): Promise<Operator[]> {
    // If we have data for this config and not forcing refresh, return cached
    if (!forceRefresh && activeConfigId.value === configId && operators.value.length > 0) {
      logger.info('Using cached operators from store', { configId });
      return operators.value;
    }

    loading.value = true;
    try {
      logger.info('Fetching operators from Firestore', { configId, forceRefresh });
      const data = await operatorsService.getOperatorsByConfig(configId);
      setOperators(data, configId);
      return data;
    } catch (err) {
      logger.error('Error in loadOperators', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Clears state and localStorage
   */
  function clearCache() {
    operators.value = [];
    lastUpdated.value = null;
    activeConfigId.value = null;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(CACHE_CONFIG_KEY);
  }

  return {
    // State
    operators,
    lastUpdated,
    activeConfigId,
    loading,
    // Computed
    hasData,
    // Actions
    init,
    setOperators,
    loadOperators,
    clearCache,
  };
});
