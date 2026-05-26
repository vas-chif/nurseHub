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
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public class ShiftWidgetProvider extends AppWidgetProvider {

    // Must match PreferencesConfiguration.DEFAULTS.group in @capacitor/preferences v8+
    private static final String PREFS_FILE   = "CapacitorStorage";
    private static final String PREF_KEY     = "widget_shifts_data";

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

        // ── Tap anywhere → open app ──────────────────────────────────────────
        Intent openIntent = new Intent(ctx, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            ctx, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, pending);

        // ── Read JSON from SharedPreferences written by @capacitor/preferences ──
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);
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
                        } else {
                            String shift = (dayMap != null)
                                ? dayMap.optString(String.valueOf(dayNum), "")
                                : "";

                            // Display: "15" or "15\nM"
                            String cellText = shift.isEmpty()
                                ? String.valueOf(dayNum)
                                : dayNum + "\n" + shift;

                            views.setTextViewText(resId, cellText);
                            views.setTextColor(resId, cellColor(shift, dayNum == todayDay));
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
     * Returns the ARGB text color for a given shift code.
     * Today's cell gets full-white brightness; other cells use a dimmed alpha.
     *
     * @param shift   ShiftCode string (M, P, N, R, A, S, MP, N11, N12, …)
     * @param isToday Whether this day is today (for highlight)
     */
    private static int cellColor(String shift, boolean isToday) {
        int alpha = isToday ? 0xFF : 0xCC;

        switch (shift) {
            case "M":                        // Mattina — blue
                return Color.argb(alpha, 0x64, 0xB5, 0xF6);
            case "P":                        // Pomeriggio — green
                return Color.argb(alpha, 0x81, 0xC7, 0x84);
            case "N": case "N11": case "N12": // Notte — purple
                return Color.argb(alpha, 0xBA, 0x68, 0xC8);
            case "MP":                       // Mattina+Pomeriggio — indigo
                return Color.argb(alpha, 0x79, 0x86, 0xCB);
            case "R":                        // Riposo — orange
                return Color.argb(alpha, 0xFF, 0xB7, 0x4D);
            case "A":                        // Assenza/Ferie — red
                return Color.argb(alpha, 0xEF, 0x53, 0x50);
            case "S":                        // Straordinario — teal
                return Color.argb(alpha, 0x4D, 0xB6, 0xAC);
            default:                         // No shift / unknown — grey
                return isToday
                    ? Color.argb(0xFF, 0xFF, 0xFF, 0xFF)
                    : Color.argb(0x77, 0xFF, 0xFF, 0xFF);
        }
    } /*end cellColor*/

} /*end ShiftWidgetProvider*/

