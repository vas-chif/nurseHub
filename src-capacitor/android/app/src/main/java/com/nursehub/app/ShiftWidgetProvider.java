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
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.text.Html;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public class ShiftWidgetProvider extends AppWidgetProvider {

    // Must match PreferencesConfiguration.DEFAULTS.group in @capacitor/preferences v8+
    private static final String PREFS_FILE        = "CapacitorStorage";
    private static final String PREF_KEY          = "widget_shifts_data";
    /** Written by WidgetBridgeService.ts → setWidgetClickable(). Default: "true". */
    private static final String PREF_KEY_CLICKABLE  = "widget_clickable";
    /** Index of the currently displayed month in the months array: 0=prev, 1=current, 2=next. */
    private static final String PREF_KEY_VIEW_INDEX = "widget_month_idx";
    /** Broadcast action: navigate to previous month. */
    private static final String ACTION_PREV         = "com.nursehub.app.WIDGET_PREV_MONTH";
    /** Broadcast action: navigate to next month. */
    private static final String ACTION_NEXT         = "com.nursehub.app.WIDGET_NEXT_MONTH";

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

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_PREV.equals(action) || ACTION_NEXT.equals(action)) {
            SharedPreferences prefs =
                context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);
            int idx = 1;
            try { idx = Integer.parseInt(prefs.getString(PREF_KEY_VIEW_INDEX, "1")); }
            catch (NumberFormatException ignored) {}
            if (ACTION_PREV.equals(action)) idx = Math.max(0, idx - 1);
            else                             idx = Math.min(2, idx + 1);
            prefs.edit().putString(PREF_KEY_VIEW_INDEX, String.valueOf(idx)).apply();
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName comp = new ComponentName(context, ShiftWidgetProvider.class);
            for (int id : mgr.getAppWidgetIds(comp)) updateWidget(context, mgr, id);
        }
    } /*end onReceive*/

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
        } else {
            // Explicitly clear any previously registered PendingIntent so the
            // widget becomes truly non-interactive when the user disables tapping.
            views.setOnClickPendingIntent(R.id.widget_container, null);
        }
        // ── Current view index (0=prev month, 1=current, 2=next) ────────────
        int viewIdx = 1;
        try { viewIdx = Integer.parseInt(prefs.getString(PREF_KEY_VIEW_INDEX, "1")); }
        catch (NumberFormatException ignored) {}
        viewIdx = Math.max(0, Math.min(2, viewIdx));

        String raw = prefs.getString(PREF_KEY, "");

        if (raw.isEmpty()) {
            views.setTextViewText(R.id.widget_user_name, "NurseHub");
            views.setTextViewText(R.id.widget_month_label, "Apri app → Impostazioni");
            fillEmptyGrid(ctx, views);
            setNavButtons(ctx, views, false, false);
            mgr.updateAppWidget(widgetId, views);
            return;
        }

        try {
            JSONObject data = new JSONObject(raw);
            String userName = data.optString("name", "");

            // ── Multi-month format (months[]) vs legacy single-month ─────────
            JSONArray monthsArr = data.optJSONArray("months");
            JSONObject monthData;
            boolean hasMulti = (monthsArr != null && monthsArr.length() == 3);
            if (hasMulti) {
                monthData = monthsArr.optJSONObject(viewIdx);
                if (monthData == null) { monthData = monthsArr.optJSONObject(1); viewIdx = 1; }
            } else {
                monthData = data; // legacy: payload itself is the month data
                viewIdx = 1;
            }

            String monthStr    = monthData.optString("month", "");
            JSONObject dayMap     = monthData.optJSONObject("days");
            JSONObject prevDayMap = monthData.optJSONObject("prevDays");
            JSONObject nextDayMap = monthData.optJSONObject("nextDays");
            JSONObject customShifts = data.optJSONObject("customShifts");

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

                Calendar cal = Calendar.getInstance(Locale.ITALY);
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

                // Previous month's day count — needed for faded out-of-month cells
                Calendar prevCal = Calendar.getInstance();
                prevCal.set(year, month - 1, 1); // Calendar month is 0-based → month-1 = current
                prevCal.add(Calendar.MONTH, -1); // roll back one month (handles January → December)
                int prevMonthDays = prevCal.getActualMaximum(Calendar.DAY_OF_MONTH);

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
                            int displayDay = (dayNum < 1)
                                ? prevMonthDays + dayNum   // e.g. 30 + (-3) = April 27
                                : dayNum - daysInMonth;    // e.g. 32 - 31 = June 1
                            JSONObject adjMap = (dayNum < 1) ? prevDayMap : nextDayMap;
                            String adjShift = (adjMap != null)
                                ? adjMap.optString(String.valueOf(displayDay), "")
                                : "";
                            // Show shift if available; always faded (0.55α) to mark adjacent month
                            views.setTextViewText(resId,
                                Html.fromHtml(buildCellHtml(adjShift, displayDay, false, customShifts),
                                    Html.FROM_HTML_MODE_COMPACT));
                            views.setInt(resId, "setBackgroundResource",
                                cellBgResource(adjShift, false, customShifts));
                            views.setFloat(resId, "setAlpha", 0.55f);
                        } else {
                            String shift = (dayMap != null)
                                ? dayMap.optString(String.valueOf(dayNum), "")
                                : "";

                            // HTML multi-styled text: small grey day number + large bold colored shift letter
                            views.setTextViewText(resId,
                                Html.fromHtml(buildCellHtml(shift, dayNum, dayNum == todayDay, customShifts),
                                    Html.FROM_HTML_MODE_COMPACT));
                            views.setInt(resId, "setBackgroundResource",
                                cellBgResource(shift, dayNum == todayDay, customShifts));
                            views.setFloat(resId, "setAlpha", 1.0f); // reset from any adjacent-month state
                        }
                    }
                }
            } else {
                fillEmptyGrid(ctx, views);
            }

            // ── Navigation buttons (always wired, dimmed at boundary) ────────
            final int fi = viewIdx;
            setNavButtons(ctx, views, hasMulti && fi > 0, hasMulti && fi < 2);

        } catch (JSONException | NumberFormatException e) {
            fillEmptyGrid(ctx, views);
            setNavButtons(ctx, views, false, false);
        }

        mgr.updateAppWidget(widgetId, views);
    } /*end updateWidget*/

    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Wires prev/next month broadcast PendingIntents to the arrow buttons.
     * Buttons are always present (even when widget_clickable=false) and are
     * visually dimmed when navigation is not available (at month boundary).
     */
    private static void setNavButtons(Context ctx, RemoteViews views,
                                      boolean canPrev, boolean canNext) {
        Intent prevIntent = new Intent(ctx, ShiftWidgetProvider.class);
        prevIntent.setAction(ACTION_PREV);
        PendingIntent prevPending = PendingIntent.getBroadcast(
            ctx, 1, prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_prev, prevPending);
        views.setFloat(R.id.widget_btn_prev, "setAlpha", canPrev ? 1.0f : 0.25f);

        Intent nextIntent = new Intent(ctx, ShiftWidgetProvider.class);
        nextIntent.setAction(ACTION_NEXT);
        PendingIntent nextPending = PendingIntent.getBroadcast(
            ctx, 2, nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_next, nextPending);
        views.setFloat(R.id.widget_btn_next, "setAlpha", canNext ? 1.0f : 0.25f);
    } /*end setNavButtons*/

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
     * @param shift        ShiftCode string
     * @param customShifts JSONObject containing custom definitions
     */
    private static String getHexForShift(String shift, JSONObject customShifts) {
        if (customShifts != null && customShifts.has(shift)) {
            JSONObject custom = customShifts.optJSONObject(shift);
            if (custom != null && custom.has("color")) {
                return custom.optString("color");
            }
        }
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
     * Returns a Unicode symbol mirroring the §1.12 SSoT shift icon
     * (useShiftLogic.ts: light_mode / wb_twilight / dark_mode / hotel / logout / event_busy).
     *
     * @param shift        ShiftCode string
     * @param customShifts JSONObject containing custom definitions
     */
    private static String getIconForShift(String shift, JSONObject customShifts) {
        if (customShifts != null && customShifts.has(shift)) {
            JSONObject custom = customShifts.optJSONObject(shift);
            if (custom != null && custom.has("icon")) {
                String matIcon = custom.optString("icon");
                switch (matIcon) {
                    case "light_mode": return "\u2600";
                    case "wb_twilight": return "\u263C";
                    case "dark_mode": return "\u263E";
                    case "hotel": return "\u2302";
                    case "logout": return "\u2197";
                    case "event_busy": return "\u2715";
                    default: return "\u25CF"; // generic dot for unknown icons
                }
            }
        }
        switch (shift) {
            case "M": case "MP":              return "\u2600"; // ☀ sun       (light_mode)
            case "P":                         return "\u263C"; // ☼ sun-rays  (wb_twilight)
            case "N": case "N11": case "N12": return "\u263E"; // ☾ moon      (dark_mode)
            case "R":                         return "\u2302"; // ⌂ house/bed (hotel)
            case "S":                         return "\u2197"; // ↗ arrow     (logout)
            case "A":                         return "\u2715"; // ✕ cancel    (event_busy)
            default:                          return "";
        }
    } /*end getIconForShift*/

    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Builds HTML-formatted cell text:
     * - Top line: day number, small (0.8x), grey — or blue for today.
     * - Bottom line: shift letter, large (1.25x) bold, shift-specific color.
     *   Absent when no shift is assigned (only day number shown).
     *
     * @param shift        ShiftCode string (may be empty)
     * @param dayNum       Calendar day of month
     * @param isToday      Whether this cell represents today
     * @param customShifts JSONObject containing custom definitions
     */
    private static String buildCellHtml(String shift, int dayNum, boolean isToday, JSONObject customShifts) {
        String dayColor = isToday ? "#1565C0" : "#94A3B8";
        String dayPart = "<small><font color='" + dayColor + "'>" + dayNum + "</font></small>";
        if (shift.isEmpty()) {
            return dayPart;
        }
        String shiftColor = getHexForShift(shift, customShifts);
        String icon = getIconForShift(shift, customShifts);
        String iconPart = icon.isEmpty()
            ? ""
            : "<br/><small><font color='" + shiftColor + "'>" + icon + "</font></small>";
        return dayPart
            + "<br/><big><b><font color='" + shiftColor + "'>" + shift + "</font></b></big>"
            + iconPart;
    } /*end buildCellHtml*/

    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Returns the drawable resource ID for the cell background.
     * Shift cells get a colored top-strip card drawable (§1.12 SSoT colors).
     * Today's cell gets a blue-bordered outline regardless of shift type.
     * Empty cells (no assigned shift) get a subtle neutral card.
     *
     * @param shift        ShiftCode string
     * @param isToday      Whether this day is today
     * @param customShifts JSONObject containing custom definitions
     */
    private static int cellBgResource(String shift, boolean isToday, JSONObject customShifts) {
        if (isToday) return R.drawable.widget_cell_bg_today;
        
        if (customShifts != null && customShifts.has(shift)) {
            // Android Widgets can't dynamically tint XML drawables easily.
            // We return empty card, but the text/icon will be custom colored in buildCellHtml.
            return R.drawable.widget_cell_bg_empty;
        }

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

