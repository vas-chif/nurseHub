/**
 * @file widgetPlugin.ts
 * @description Typed wrapper for the NurseHubWidget Capacitor plugin.
 *              Writes today's shift code to native SharedPreferences so
 *              the Android home screen widget can display it.
 * @author Nurse Hub Team
 * @created 2026-05-18
 * @modified 2026-05-18
 * @notes
 *   - Only active on native Android (no-op on web / iOS).
 *   - Called from MainLayout.vue whenever scheduleStore.operators updates.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

interface NurseHubWidgetPlugin {
  updateTodayShift(options: { shiftCode: string }): Promise<void>;
}

const NurseHubWidget = registerPlugin<NurseHubWidgetPlugin>('NurseHubWidget', {
  web: {
    updateTodayShift: async () => {
      /* no-op: widget is Android-only */
    },
  },
});

/**
 * Writes today's shift code to native SharedPreferences and triggers
 * an immediate widget refresh. Safe to call on web — it becomes a no-op.
 */
export async function syncWidgetShift(shiftCode: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NurseHubWidget.updateTodayShift({ shiftCode });
  } catch {
    /* widget plugin unavailable — non-critical */
  }
}
