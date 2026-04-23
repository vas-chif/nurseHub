/**
 * @file adminStore.ts
 * @description Pinia store for administrative state, suggestions, and request publishing.
 * @author Nurse Hub Team
 * @created 2026-03-15
 * @modified 2026-04-23
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ScenarioGroup, ShiftRequest } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

export const useAdminStore = defineStore('admin', () => {
  const logger = useSecureLogger();
  // State for substitute suggestions (persists across navigation)
  const suggestions = ref<Record<string, ScenarioGroup[]>>({});
  const selectedSuggestions = ref<Record<string, string[]>>({});
  const calculating = ref<Record<string, boolean>>({});

  function setSuggestions(reqId: string, results: ScenarioGroup[]) {
    suggestions.value[reqId] = results;
  }

  // Updated signature to accept array of operatorIds for "Select All" feature
  function toggleSelection(reqId: string, operatorIds: string | string[], val?: boolean) {
    if (!selectedSuggestions.value[reqId]) {
      selectedSuggestions.value[reqId] = [];
    }
    const list = selectedSuggestions.value[reqId];
    if (!list) return; // TS guard

    const ids = Array.isArray(operatorIds) ? operatorIds : [operatorIds];
    const forceVal = val; // if provided, force select/deselect

    ids.forEach((opId) => {
      const index = list.indexOf(opId); // list is guaranteed defined here
      if (forceVal !== undefined) {
        if (forceVal && index === -1) list.push(opId);
        else if (!forceVal && index !== -1) list.splice(list.indexOf(opId), 1);
      } else {
        // Toggle
        if (index === -1) list.push(opId);
        else list.splice(index, 1);
      }
    });
  }

  function clearSuggestions(reqId: string) {
    if (suggestions.value[reqId]) delete suggestions.value[reqId];
    if (selectedSuggestions.value[reqId]) delete selectedSuggestions.value[reqId];
    if (calculating.value[reqId]) delete calculating.value[reqId];
  }

  async function calculateSuggestions(req: ShiftRequest) {
    calculating.value[req.id] = true;
    try {
      // Simulating delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const results: ScenarioGroup[] = [];
      suggestions.value[req.id] = results;
    } finally {
      calculating.value[req.id] = false;
    }
  }

  function publishToCandidates(req: ShiftRequest) {
    // Logic to send notifications/emails to selected candidates
    const selected = selectedSuggestions.value[req.id] || [];
    logger.info('Publishing request', { reqId: req.id, candidateCount: selected.length });
  }

  return {
    suggestions,
    selectedSuggestions,
    calculating,
    setSuggestions,
    toggleSelection,
    clearSuggestions,
    calculateSuggestions,
    publishToCandidates,
  };
});
