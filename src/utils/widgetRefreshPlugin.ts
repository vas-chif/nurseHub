/**
 * @file widgetRefreshPlugin.ts
 * @description Typed TypeScript wrapper for the native WidgetRefreshPlugin
 *              Capacitor plugin. Triggers an immediate APPWIDGET_UPDATE
 *              broadcast so the home screen widget re-renders after new shift
 *              data is written to SharedPreferences.
 * @author Nurse Hub Team
 * @created 2026-05-26
 * @modified 2026-05-26
 * @notes
 *   - No-op on web platform (Capacitor.isNativePlatform() guard in caller).
 *   - Native implementation: WidgetRefreshPlugin.java.
 *   - Called exclusively from WidgetBridgeService.ts after Preferences.set().
 *   - §1.12 DRY: single responsibility — only triggers widget refresh.
 */
import { registerPlugin } from '@capacitor/core';

interface WidgetRefreshPluginInterface {
  /** Broadcasts APPWIDGET_UPDATE to all ShiftWidgetProvider instances. */
  refresh(): Promise<void>;
}

const WidgetRefreshPlugin = registerPlugin<WidgetRefreshPluginInterface>('WidgetRefresh', {
  // Web stub — never called because syncWidgetData is guarded by isNativePlatform()
  web: {
    refresh: async () => { /* no-op on web */ },
  },
});

export { WidgetRefreshPlugin };
