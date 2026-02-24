/**
 * @file scenarioStore.ts
 * @description Pinia store for caching replacement scenarios from Firestore.
 * Scenarios are loaded once per session per configId and cached in memory.
 * Falls back to hardcoded REPLACEMENT_SCENARIOS if Firestore is unavailable.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../boot/firebase';
import { REPLACEMENT_SCENARIOS } from '../config/sheets';
import type { ReplacementScenario } from '../types/models';

export const useScenarioStore = defineStore('scenarios', () => {
  const scenarios = ref<ReplacementScenario[]>([...REPLACEMENT_SCENARIOS]);
  const loadedConfigId = ref<string | null>(null);
  const loading = ref(false);

  /**
   * Loads replacement scenarios for the given configId from Firestore.
   * Uses cached value if the same configId was already loaded.
   */
  async function loadScenarios(configId: string): Promise<void> {
    if (loadedConfigId.value === configId) return; // Already loaded
    if (!configId) return;

    loading.value = true;
    try {
      const colRef = collection(db, 'systemConfigurations', configId, 'replacementScenarios');
      const snap = await getDocs(colRef);

      if (!snap.empty) {
        scenarios.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReplacementScenario);
        loadedConfigId.value = configId;
      } else {
        // Firestore subcollection empty — fall back to hardcoded defaults
        console.warn('[ScenarioStore] No Firestore scenarios found, using defaults from sheets.ts');
        scenarios.value = [...REPLACEMENT_SCENARIOS];
        loadedConfigId.value = configId;
      }
    } catch (e) {
      // Permission error or network issue — fall back gracefully
      console.warn('[ScenarioStore] Failed to load Firestore scenarios, using defaults.', e);
      scenarios.value = [...REPLACEMENT_SCENARIOS];
    } finally {
      loading.value = false;
    }
  }

  /** Force-reload scenarios (used after admin edits) */
  function invalidate() {
    loadedConfigId.value = null;
  }

  return {
    scenarios,
    loading,
    loadedConfigId,
    loadScenarios,
    invalidate,
  };
});
