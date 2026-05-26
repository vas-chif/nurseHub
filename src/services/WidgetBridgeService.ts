/**
 * @file WidgetBridgeService.ts
 * @description Bridge service that serializes the current user's monthly shift schedule
 *              to Android SharedPreferences via @capacitor/preferences, so the
 *              native home screen widget can render the grid without network access.
 * @author Nurse Hub Team
 * @created 2026-05-18
 * @modified 2026-05-18
 * @notes
 * - Architecture pattern: Service (pure I/O — zero business logic, §1.12 DRY)
 * - Only active on native platform (Capacitor.isNativePlatform()); no-op on web.
 * - GDPR §1.5: data is written ONLY after explicit user consent
 *   (WIDGET_PRIVACY_KEY = 'true' stored in preferences).
 * - Reads operator.schedule (Record<string, ShiftCode>) from scheduleStore via caller.
 * - Month names are derived from YYYY-MM — no locale array duplication (§ DRY).
 * - @capacitor/preferences writes to Android SharedPreferences file "_capPrefStore".
 *   The Java widget reads from the same file using Context.getSharedPreferences().
 * @dependencies
 * - @capacitor/core (Capacitor.isNativePlatform)
 * - @capacitor/preferences (Preferences.get/set/remove)
 * - src/types/models (Operator, ShiftCode)
 * - src/utils/secureLogger (§1.3 — no console.log)
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { Operator, ShiftCode } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';
import { WidgetRefreshPlugin } from '../utils/widgetRefreshPlugin';

const logger = useSecureLogger();

/** SharedPreferences key storing the monthly shifts JSON blob consumed by the widget. */
export const WIDGET_PREF_KEY = 'widget_shifts_data';

/** SharedPreferences key recording GDPR consent ('true' | absent). */
export const WIDGET_PRIVACY_KEY = 'widget_privacy_accepted';

/** SharedPreferences key for widget tap-to-open behaviour ('true' | 'false'). Default: true. */
export const WIDGET_CLICKABLE_KEY = 'widget_clickable';

/**
 * The JSON payload written to SharedPreferences.
 * Android ShiftWidgetProvider parses this via org.json.JSONObject.
 */
export interface WidgetShiftsPayload {
  /** Calendar month in YYYY-MM format (e.g. "2026-05"). */
  month: string;
  /** User first name shown in the widget header. */
  name: string;
  /** Day-of-month (as string key) → ShiftCode mapping for the current month. */
  days: Record<string, ShiftCode>;
  /** Shifts for the tail days of the previous month shown in the first grid row. */
  prevDays?: Record<string, ShiftCode>;
  /** Shifts for the head days of the next month shown in the last grid row. */
  nextDays?: Record<string, ShiftCode>;
}

/**
 * Returns whether the user has accepted the widget privacy disclaimer.
 *
 * @returns true if consent was recorded, false on web or if not accepted yet.
 *
 * @example
 * ```typescript
 * if (await isWidgetPrivacyAccepted()) { ... }
 * ```
 */
export async function isWidgetPrivacyAccepted(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { value } = await Preferences.get({ key: WIDGET_PRIVACY_KEY });
    return value === 'true';
  } catch (err) {
    logger.error('WidgetBridge: failed to read privacy consent', err);
    return false;
  }
} /*end isWidgetPrivacyAccepted*/

/**
 * Stores the user's explicit acceptance of the widget privacy disclaimer (GDPR §1.5).
 */
export async function acceptWidgetPrivacy(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Preferences.set({ key: WIDGET_PRIVACY_KEY, value: 'true' });
} /*end acceptWidgetPrivacy*/

/**
 * Serializes the operator's current-month schedule to SharedPreferences
 * so the Android home screen widget can display the monthly shift grid.
 *
 * @param operator     - The Operator document owned by the currently logged-in user.
 * @param displayName  - First name (or fallback) shown in the widget header.
 *
 * @remarks
 * - Silent no-op when not on native platform.
 * - Silent no-op when privacy consent has not been given.
 * - Only extracts days in the current calendar month (YYYY-MM prefix match).
 * - Safe to call on every scheduleStore update; writing is idempotent.
 *
 * @example
 * ```typescript
 * import { syncWidgetData } from '../services/WidgetBridgeService';
 * const mine = scheduleStore.operators.find(op => op.userId === authStore.currentUser?.uid);
 * if (mine) await syncWidgetData(mine, authStore.currentUser?.firstName ?? '');
 * ```
 */
export async function syncWidgetData(operator: Operator, displayName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const accepted = await isWidgetPrivacyAccepted();
    if (!accepted) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;

    const days: Record<string, ShiftCode> = {};
    for (const [dateKey, shiftCode] of Object.entries(operator.schedule)) {
      if (dateKey.startsWith(monthPrefix)) {
        const dayPart = dateKey.split('-')[2];
        const dayNum = dayPart !== undefined ? parseInt(dayPart, 10) : NaN;
        if (!isNaN(dayNum) && dayNum > 0) {
          days[String(dayNum)] = shiftCode;
        }
      }
    }

    // Adjacent-month days visible in the 6-week grid (last N days of prev month + first M of next)
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevMonthPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}-`;
    const prevDays: Record<string, ShiftCode> = {};
    for (const [dateKey, shiftCode] of Object.entries(operator.schedule)) {
      if (dateKey.startsWith(prevMonthPrefix)) {
        const dayPart = dateKey.split('-')[2];
        const dayNum = dayPart !== undefined ? parseInt(dayPart, 10) : NaN;
        if (!isNaN(dayNum) && dayNum > 0) prevDays[String(dayNum)] = shiftCode;
      }
    }

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const nextMonthPrefix = `${nextYear}-${String(nextMonth).padStart(2, '0')}-`;
    const nextDays: Record<string, ShiftCode> = {};
    for (const [dateKey, shiftCode] of Object.entries(operator.schedule)) {
      if (dateKey.startsWith(nextMonthPrefix)) {
        const dayPart = dateKey.split('-')[2];
        const dayNum = dayPart !== undefined ? parseInt(dayPart, 10) : NaN;
        if (!isNaN(dayNum) && dayNum > 0) nextDays[String(dayNum)] = shiftCode;
      }
    }

    const payload: WidgetShiftsPayload = {
      month: `${year}-${String(month).padStart(2, '0')}`,
      name: displayName,
      days,
      ...(Object.keys(prevDays).length > 0 && { prevDays }),
      ...(Object.keys(nextDays).length > 0 && { nextDays }),
    };

    await Preferences.set({ key: WIDGET_PREF_KEY, value: JSON.stringify(payload) });

    // Broadcast APPWIDGET_UPDATE immediately so widget re-renders without
    // waiting for the passive 30-minute update cycle.
    await WidgetRefreshPlugin.refresh();

    logger.info('WidgetBridge: schedule synced to SharedPreferences', {
      month: payload.month,
      daysWithShift: Object.keys(days).length,
    });
  } catch (err) {
    logger.error('WidgetBridge: failed to sync schedule', err);
  }
} /*end syncWidgetData*/

/**
 * Removes all widget data and privacy consent from SharedPreferences.
 * Called when the user disables the widget toggle in Settings.
 */
export async function clearWidgetData(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.remove({ key: WIDGET_PREF_KEY });
    await Preferences.remove({ key: WIDGET_PRIVACY_KEY });
    logger.info('WidgetBridge: all widget data cleared');
  } catch (err) {
    logger.error('WidgetBridge: failed to clear data', err);
  }
} /*end clearWidgetData*/

/**
 * Returns whether the widget tap-to-open behaviour is enabled.
 * Defaults to true when the preference has not been set yet.
 *
 * @returns true if widget is clickable (default), false if explicitly disabled.
 */
export async function isWidgetClickable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const { value } = await Preferences.get({ key: WIDGET_CLICKABLE_KEY });
    return value !== 'false'; // absent or 'true' → true
  } catch (err) {
    logger.error('WidgetBridge: failed to read widget_clickable', err);
    return true;
  }
} /*end isWidgetClickable*/

/**
 * Persists the widget tap-to-open preference and triggers an immediate widget refresh.
 *
 * @param value true = widget tap opens app; false = widget is non-interactive.
 */
export async function setWidgetClickable(value: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key: WIDGET_CLICKABLE_KEY, value: value ? 'true' : 'false' });
    await WidgetRefreshPlugin.refresh();
    logger.info('WidgetBridge: widget_clickable set to', value);
  } catch (err) {
    logger.error('WidgetBridge: failed to set widget_clickable', err);
  }
} /*end setWidgetClickable*/
