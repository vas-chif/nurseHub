import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Suggestion } from '../types/models';

export const useAdminStore = defineStore('admin', () => {
  // State for substitute suggestions (persists across navigation)
  const suggestions = ref<Record<string, Suggestion[]>>({});
  const selectedSuggestions = ref<Record<string, string[]>>({});
  const calculating = ref<Record<string, boolean>>({});

  // Additional admin state can go here
  // e.g., cached filters, pagination, etc.

  function setSuggestions(reqId: string, results: Suggestion[]) {
    suggestions.value[reqId] = results;
  }

  function toggleSelection(reqId: string, operatorId: string) {
    if (!selectedSuggestions.value[reqId]) {
      selectedSuggestions.value[reqId] = [];
    }
    const list = selectedSuggestions.value[reqId];
    if (!list) return; // TS guard though initialized above

    const index = list.indexOf(operatorId);
    if (index === -1) {
      list.push(operatorId);
    } else {
      list.splice(index, 1);
    }
  }

  function clearSuggestions(reqId: string) {
    if (suggestions.value[reqId]) delete suggestions.value[reqId];
    if (selectedSuggestions.value[reqId]) delete selectedSuggestions.value[reqId];
    if (calculating.value[reqId]) delete calculating.value[reqId];
  }

  return {
    suggestions,
    selectedSuggestions,
    calculating,
    setSuggestions,
    toggleSelection,
    clearSuggestions,
  };
});
