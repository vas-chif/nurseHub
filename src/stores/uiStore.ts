/**
 * @file uiStore.ts
 * @description Pinia store for managing UI state, such as active tabs and navigation history.
 * @author Nurse Hub Team
 * @created 2026-04-23
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  // Map of path -> activeTab
  const activeTabs = ref<Record<string, string>>(JSON.parse(localStorage.getItem('activeTabs') || '{}'));
  // Last visited path for session persistence
  const lastPath = ref<string>(localStorage.getItem('lastPath') || '/');

  /**
   * Get the active tab for a specific route path
   */
  function getActiveTab(path: string, defaultValue: string): string {
    return activeTabs.value[path] || defaultValue;
  }

  /**
   * Set and persist the active tab for a specific route path
   */
  function setActiveTab(path: string, tab: string) {
    activeTabs.value[path] = tab;
    localStorage.setItem('activeTabs', JSON.stringify(activeTabs.value));
  }

  /**
   * Set and persist the last visited path
   */
  function setLastPath(path: string) {
    lastPath.value = path;
    localStorage.setItem('lastPath', path);
  }

  return {
    activeTabs,
    lastPath,
    getActiveTab,
    setActiveTab,
    setLastPath,
  };
});
