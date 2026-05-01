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
import { useConfigStore } from './configStore';

const logger = useSecureLogger();
const CACHE_KEY = 'nurseHub_operators';
const CACHE_TS_KEY = 'nurseHub_operators_timestamp';
const CACHE_CONFIG_KEY = 'nurseHub_operators_config';

export const useScheduleStore = defineStore('schedule', () => {
  const configStore = useConfigStore();

  // State: Cache by configId
  const operatorsByConfig = ref<Record<string, Operator[]>>({});
  const lastUpdated = ref<Record<string, number>>({});
  const loading = ref(false);

  // Computed
  const operators = computed(() => {
    if (!configStore.activeConfigId) return [];
    return operatorsByConfig.value[configStore.activeConfigId] || [];
  });

  const hasData = computed(() => operators.value.length > 0);

  // Actions

  /**
   * Rehydrates store from localStorage on app launch
   */
  function init() {
    try {
      const savedOps = localStorage.getItem(CACHE_KEY);
      const savedTs = localStorage.getItem(CACHE_TS_KEY);

      if (savedOps && savedTs) {
        // Migration check from old format to new format
        const parsedOps = JSON.parse(savedOps);
        if (Array.isArray(parsedOps)) {
          // Legacy format, clear it
          clearCache();
        } else {
          operatorsByConfig.value = parsedOps;
          lastUpdated.value = JSON.parse(savedTs);
          logger.info('Schedule store rehydrated from cache', {
            configsCached: Object.keys(operatorsByConfig.value).length
          });
        }
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
    operatorsByConfig.value[configId] = data;
    lastUpdated.value[configId] = Date.now();

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(operatorsByConfig.value));
      localStorage.setItem(CACHE_TS_KEY, JSON.stringify(lastUpdated.value));
    } catch (err) {
      logger.error('Failed to persist operators to localStorage', err);
    }
  }

  /**
   * Fetches operators from service, using cache if available and not forced
   */
  async function loadOperators(configId: string, forceRefresh = false): Promise<Operator[]> {
    if (!configId) return [];

    // If we have data for this config and not forcing refresh, return cached
    if (!forceRefresh && (operatorsByConfig.value[configId]?.length ?? 0) > 0) {
      logger.info('Using cached operators from store', { configId });
      return operatorsByConfig.value[configId] || [];
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
    operatorsByConfig.value = {};
    lastUpdated.value = {};
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(CACHE_CONFIG_KEY);
  }

  // Get operators for current view
  function getOperatorsForConfig(configId: string): Operator[] {
    return operatorsByConfig.value[configId] || [];
  }

  return {
    operatorsByConfig,
    operators,
    lastUpdated,
    loading,
    hasData,
    init,
    loadOperators,
    clearCache,
    getOperatorsForConfig,
  };
});
