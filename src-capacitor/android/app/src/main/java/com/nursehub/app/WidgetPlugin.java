/**
 * @file WidgetPlugin.java
 * @description Capacitor plugin for updating the NurseHub home screen widget.
 *              Writes today's shift code to SharedPreferences and triggers an
 *              immediate AppWidget broadcast refresh.
 * @author Nurse Hub Team
 * @created 2026-05-18
 * @modified 2026-05-18
 * @notes
 *   - Called from TypeScript (widgetPlugin.ts) after schedule data is loaded.
 *   - SharedPreferences file "NurseHubWidget" is also read by ShiftWidgetProvider.
 *   - No-op on web (handled by web fallback in registerPlugin).
 */
package com.nursehub.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NurseHubWidget")
public class WidgetPlugin extends Plugin {

    static final String PREFS_NAME = "NurseHubWidget";
    static final String KEY_TODAY_SHIFT = "widget_today_shift";

    /** Sets today's shift code in SharedPreferences and forces a widget refresh. */
    @PluginMethod
    public void updateTodayShift(PluginCall call) {
        String shiftCode = call.getString("shiftCode", "");
        Context ctx = getContext();

        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_TODAY_SHIFT, shiftCode)
                .apply();

        // Force immediate widget refresh — Android will call ShiftWidgetProvider.onUpdate()
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, ShiftWidgetProvider.class));
        if (ids.length > 0) {
            Intent intent = new Intent(ctx, ShiftWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            ctx.sendBroadcast(intent);
        }

        call.resolve();
    } /*end updateTodayShift*/

} /*end WidgetPlugin*/
