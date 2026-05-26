/**
 * @file ShiftWidgetProvider.java
 * @description Android AppWidgetProvider that renders the user's monthly shift
 *              calendar grid on the home screen.
 *              Reads a JSON blob written by WidgetBridgeService.ts via
 *              @capacitor/preferences (SharedPreferences file "_capPrefStore").
 * @author Nurse Hub Team
 * @created 2026-05-18
 * @modified 2026-05-18
 * @notes
 *   - Widget size: 4×4 cells minimum (resizable). Layout: widget_shifts.xml.
 *   - Registered in AndroidManifest.xml as <receiver> with APPWIDGET_UPDATE.
 *   - JSON key: "widget_shifts_data" → { month, name, days: { "1":"M", ... } }
 *   - Italian week starts on Monday (offset calculation adjusts for this).
 *   - Today's cell is highlighted with a slightly brighter text color.
 *   - Shift color coding: M=blue, P=green, N=purple, R=orange, A=red, S=teal.
 *   - Tapping anywhere opens MainActivity.
 */
package com.nursehub.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.text.Html;
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public class ShiftWidgetProvider extends AppWidgetProvider {

    // Must match PreferencesConfiguration.DEFAULTS.group in @capacitor/preferences v8+
    private static final String PREFS_FILE        = "CapacitorStorage";
    private static final String PREF_KEY          = "widget_shifts_data";
    /** Written by WidgetBridgeService.ts → setWidgetClickable(). Default: "true". */
    private static final String PREF_KEY_CLICKABLE = "widget_clickable";

    private static final String[] MONTH_NAMES_IT = {
        "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
        "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"
    };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            updateWidget(ctx, mgr, id);
        }
    } /*end onUpdate*/

    // ─────────────────────────────────────────────────────────────────────────
    /** Builds and pushes RemoteViews for one widget instance. */
    private static void updateWidget(Context ctx, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_shifts);

        // ── Read SharedPreferences ───────────────────────────────────────────
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);

        // ── Tap → open app (conditional on widget_clickable, default true) ───
        String clickableVal = prefs.getString(PREF_KEY_CLICKABLE, "true");
        if (!"false".equals(clickableVal)) {
            Intent openIntent = new Intent(ctx, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                ctx, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_container, pending);
        }
        String raw = prefs.getString(PREF_KEY, "");

        if (raw.isEmpty()) {
            views.setTextViewText(R.id.widget_user_name, "NurseHub");
            views.setTextViewText(R.id.widget_month_label, "Apri app → Impostazioni");
            fillEmptyGrid(ctx, views);
            mgr.updateAppWidget(widgetId, views);
            return;
        }

        try {
            JSONObject data    = new JSONObject(raw);
            String monthStr    = data.optString("month", "");   // "2026-05"
            String userName    = data.optString("name", "");
            JSONObject dayMap  = data.optJSONObject("days");     // "1" → "M"

            // ── Header ───────────────────────────────────────────────────────
            views.setTextViewText(R.id.widget_user_name, userName.isEmpty() ? "NurseHub" : userName);

            if (!monthStr.isEmpty()) {
                String[] parts = monthStr.split("-");
                if (parts.length == 2) {
                    int mIdx = Integer.parseInt(parts[1]) - 1; // 0-based
                    int yr   = Integer.parseInt(parts[0]);
                    String label = MONTH_NAMES_IT[Math.max(0, Math.min(mIdx, 11))] + " " + yr;
                    views.setTextViewText(R.id.widget_month_label, label);
                }
            }

            // ── Calendar grid ────────────────────────────────────────────────
            if (!monthStr.isEmpty()) {
                String[] parts = monthStr.split("-");
                int year  = Integer.parseInt(parts[0]);
                int month = Integer.parseInt(parts[1]); // 1-based

                Calendar cal = Calendar.getInstance(new Locale("it", "IT"));
                cal.set(year, month - 1, 1);

                // Italian week starts Monday. Calendar.DAY_OF_WEEK: Sun=1, Mon=2 ... Sat=7
                // Convert to Monday=0, Tuesday=1, ..., Sunday=6
                int firstDow    = cal.get(Calendar.DAY_OF_WEEK);  // 1=Sun … 7=Sat
                int offset      = (firstDow + 5) % 7;             // Mon→0, Tue→1, … Sun→6
                int daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH);

                // Today's day for highlight (only if same month/year)
                Calendar today = Calendar.getInstance();
                int todayDay = -1;
                if (today.get(Calendar.YEAR) == year && today.get(Calendar.MONTH) + 1 == month) {
                    todayDay = today.get(Calendar.DAY_OF_MONTH);
                }

                for (int r = 0; r < 6; r++) {
                    for (int c = 0; c < 7; c++) {
                        int cellIndex = r * 7 + c;
                        int dayNum    = cellIndex - offset + 1;

                        String idName = "cell_r" + r + "c" + c;
                        int resId = ctx.getResources().getIdentifier(
                            idName, "id", ctx.getPackageName()
                        );
                        if (resId == 0) continue;

                        if (dayNum < 1 || dayNum > daysInMonth) {
                            views.setTextViewText(resId, "");
                            views.setInt(resId, "setBackgroundColor", Color.TRANSPARENT);
                        } else {
                            String shift = (dayMap != null)
                                ? dayMap.optString(String.valueOf(dayNum), "")
                                : "";

                            // HTML multi-styled text: small grey day number + large bold colored shift letter
                            views.setTextViewText(resId,
                                Html.fromHtml(buildCellHtml(shift, dayNum, dayNum == todayDay),
                                    Html.FROM_HTML_MODE_COMPACT));
                            views.setInt(resId, "setBackgroundResource",
                                cellBgResource(shift, dayNum == todayDay));
                        }
                    }
                }
            } else {
                fillEmptyGrid(ctx, views);
            }

        } catch (JSONException | NumberFormatException e) {
            fillEmptyGrid(ctx, views);
        }

        mgr.updateAppWidget(widgetId, views);
    } /*end updateWidget*/

    // ─────────────────────────────────────────────────────────────────────────
    /** Clears all 42 grid cells (used when no data is available). */
    private static void fillEmptyGrid(Context ctx, RemoteViews views) {
        for (int r = 0; r < 6; r++) {
            for (int c = 0; c < 7; c++) {
                String idName = "cell_r" + r + "c" + c;
                int resId = ctx.getResources().getIdentifier(
                    idName, "id", ctx.getPackageName()
                );
                if (resId != 0) {
                    views.setTextViewText(resId, "");
                }
            }
        }
    } /*end fillEmptyGrid*/

    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Returns the hex color string for a shift code's text.
     * Mirrors §1.12 SSoT (useShiftLogic.ts → SHIFT_STYLE_MAP).
     *
     * @param shift ShiftCode string
     */
    private static String getHexForShift(String shift) {
        switch (shift) {
            case "M": case "MP":              return "#F59E0B"; // amber
            case "P":                         return "#EA580C"; // orange
            case "N": case "N11": case "N12": return "#1E3A8A"; // navy
            case "R":                         return "#64748B"; // slate
            case "S":                         return "#16A34A"; // green
            case "A":                         return "#DC2626"; // red
            default:                          return "#64748B"; // grey (no shift)
        }
    } /*end getHexForShift*/

    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Builds HTML-formatted cell text:
     * - Top line: day number, small (0.8x), grey — or blue for today.
     * - Bottom line: shift letter, large (1.25x) bold, shift-specific color.
     *   Absent when no shift is assigned (only day number shown).
     *
     * @param shift   ShiftCode string (may be empty)
     * @param dayNum  Calendar day of month
     * @param isToday Whether this cell represents today
     */
    private static String buildCellHtml(String shift, int dayNum, boolean isToday) {
        String dayColor = isToday ? "#1565C0" : "#94A3B8";
        String dayPart = "<small><font color='" + dayColor + "'>" + dayNum + "</font></small>";
        if (shift.isEmpty()) {
            return dayPart;
        }
        String shiftColor = getHexForShift(shift);
        return dayPart + "<br/><big><b><font color='" + shiftColor + "'>" + shift + "</font></b></big>";
    } /*end buildCellHtml*/

    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Returns the drawable resource ID for the cell background.
     * Shift cells get a colored top-strip card drawable (§1.12 SSoT colors).
     * Today's cell gets a blue-bordered outline regardless of shift type.
     * Empty cells (no assigned shift) get a subtle neutral card.
     *
     * @param shift   ShiftCode string
     * @param isToday Whether this day is today
     */
    private static int cellBgResource(String shift, boolean isToday) {
        if (isToday) return R.drawable.widget_cell_bg_today;
        switch (shift) {
            case "M": case "MP":              return R.drawable.widget_cell_bg_m;
            case "P":                         return R.drawable.widget_cell_bg_p;
            case "N": case "N11": case "N12": return R.drawable.widget_cell_bg_n;
            case "R":                         return R.drawable.widget_cell_bg_r;
            case "S":                         return R.drawable.widget_cell_bg_s;
            case "A":                         return R.drawable.widget_cell_bg_a;
            default:                          return R.drawable.widget_cell_bg_empty;
        }
    } /*end cellBgResource*/

} /*end ShiftWidgetProvider*/

