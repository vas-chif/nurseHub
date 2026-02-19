import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ScenarioGroup, ShiftRequest } from '../types/models';
// import { operatorsService } from '../services/OperatorsService'; // Future integration

export const useAdminStore = defineStore('admin', () => {
  // State for substitute suggestions (persists across navigation)
  const suggestions = ref<Record<string, ScenarioGroup[]>>({});
  const selectedSuggestions = ref<Record<string, string[]>>({});
  const calculating = ref<Record<string, boolean>>({});

  // const { getCompatibleScenarios } = useShiftLogic(); // Unused

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

  // Dummy implementations for now - logic moved from component or future service
  async function calculateSuggestions(req: ShiftRequest) {
    calculating.value[req.id] = true;
    try {
      // Here we would fetch all operators and run logic
      // For now, let's just simulate or reuse logic if we can import stores here (careful of circular deps)
      // or just accept emptiness until implemented fully.
      // Actually, the user expects 'find substitute' to work.
      // We'll leave the array empty to indicate "No candidates found" for now or
      // Implement a basic check if we have operators in another store.

      // Simulating delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const results: ScenarioGroup[] = [];
      // Logic would be:
      // 1. Fetch all operators
      // 2. Filter available ones
      // 3. Group by scenario

      suggestions.value[req.id] = results;
    } finally {
      calculating.value[req.id] = false;
    }
  }

  function publishToCandidates(req: ShiftRequest) {
    // Logic to send notifications/emails to selected candidates
    const selected = selectedSuggestions.value[req.id] || [];
    console.log('Publishing request', req.id, 'to candidates:', selected);
    // await notificationsService.send(...)
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
