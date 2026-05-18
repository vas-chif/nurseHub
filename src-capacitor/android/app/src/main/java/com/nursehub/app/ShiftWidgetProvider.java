/**
 * @file ShiftWidgetProvider.java
 * @description Android AppWidget provider for NurseHub home screen widget.
 *              Shows today's shift code read from SharedPreferences (written by
 *              the Capacitor web layer via window.__nurseHubWidget bridge or
 *              directly via CapacitorStorage).
 * @author Nurse Hub Team
 * @created 2026-05-18
 * @modified 2026-05-18
 * @notes
 *   - Registered in AndroidManifest.xml as a <receiver> with APPWIDGET_UPDATE action.
 *   - Reads shift key "widget_today_shift" from SharedPreferences "CapacitorStorage".
 *   - Tapping the widget opens MainActivity (main app entry point).
 *   - Widget updates every 30 min (updatePeriodMillis = 1800000 in widget_shifts_info.xml).
 */
package com.nursehub.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

public class ShiftWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = WidgetPlugin.PREFS_NAME;
    private static final String KEY_TODAY_SHIFT = WidgetPlugin.KEY_TODAY_SHIFT;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    } /*end onUpdate*/

    /** Builds and pushes the RemoteViews for a single widget instance. */
    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_shifts);

        // Tap → open app
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        // Read today's shift written by the web layer
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String todayShift = prefs.getString(KEY_TODAY_SHIFT, "");

        if (todayShift != null && !todayShift.isEmpty()) {
            views.setTextViewText(R.id.widget_shift_text, "Turno di oggi");
            views.setTextViewText(R.id.widget_shift_badge, todayShift);
            views.setViewVisibility(R.id.widget_shift_badge, View.VISIBLE);
        } else {
            views.setTextViewText(R.id.widget_shift_text, "Apri per vedere i turni");
            views.setViewVisibility(R.id.widget_shift_badge, View.GONE);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    } /*end updateWidget*/

} /*end ShiftWidgetProvider*/
