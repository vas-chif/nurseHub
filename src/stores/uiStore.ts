/**
 * @file uiStore.ts
 * @description Pinia store for managing UI state, such as active tabs and navigation history.
 * @author Nurse Hub Team
 * @created 2026-04-23
 * @modified 2026-05-12
 * @notes
 * - Phase 34: Added viewMode for Dual-View Management (Admin vs User).
 * - viewMode is persisted per-device via localStorage.
 * - Gatekeeper: setViewMode() must only be called when authStore.isAnyAdmin is true.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  // Map of path -> activeTab
  const activeTabs = ref<Record<string, string>>(JSON.parse(localStorage.getItem('activeTabs') || '{}'));
  // Last visited path for session persistence
  const lastPath = ref<string>(localStorage.getItem('lastPath') || '/');
  // Visibility of bottom tabs (for admins)
  const visibleTabs = ref<Record<string, boolean>>(JSON.parse(localStorage.getItem('visibleTabs') || '{}'));

  // Phase 34: Dual-View Management — persisted per device
  const VIEW_MODE_KEY = 'nhub_view_mode';
  const viewMode = ref<'admin' | 'user'>(
    (localStorage.getItem(VIEW_MODE_KEY) as 'admin' | 'user') ?? 'admin'
  );

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

  /**
   * Toggle tab visibility and persist
   */
  function toggleTabVisibility(tabId: string, isVisible: boolean) {
    visibleTabs.value[tabId] = isVisible;
    localStorage.setItem('visibleTabs', JSON.stringify(visibleTabs.value));
  }

  /**
   * Check if a tab is visible
   */
  function isTabVisible(tabId: string, defaultVal = true): boolean {
    return visibleTabs.value[tabId] ?? defaultVal;
  }

  /**
   * Phase 34: Switch between Admin and User view modes.
   * MUST be called only when authStore.isAnyAdmin is true (enforced by caller).
   */
  function setViewMode(mode: 'admin' | 'user'): void {
    viewMode.value = mode;
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  return {
    activeTabs,
    lastPath,
    visibleTabs,
    viewMode,
    getActiveTab,
    setActiveTab,
    setLastPath,
    toggleTabVisibility,
    isTabVisible,
    setViewMode,
  };
});
