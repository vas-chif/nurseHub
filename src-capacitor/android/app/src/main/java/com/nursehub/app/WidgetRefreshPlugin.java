/**
 * @file WidgetRefreshPlugin.java
 * @description Capacitor plugin that broadcasts APPWIDGET_UPDATE immediately
 *              after WidgetBridgeService.ts writes new shift data to
 *              SharedPreferences, so the home screen widget refreshes without
 *              waiting for the 30-minute passive cycle.
 * @author Nurse Hub Team
 * @created 2026-05-26
 * @modified 2026-05-26
 * @notes
 *   - Single responsibility: one method `refresh()` — §1.12 DRY.
 *   - Registered in MainActivity.java via registerPlugin().
 *   - TypeScript wrapper: src/utils/widgetRefreshPlugin.ts.
 *   - Android widget receiver: ShiftWidgetProvider.java.
 */
package com.nursehub.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetRefresh")
public class WidgetRefreshPlugin extends Plugin {

    /**
     * Broadcasts APPWIDGET_UPDATE to all instances of ShiftWidgetProvider,
     * forcing an immediate re-render of the home screen widget grid.
     *
     * <p>Called from TS via WidgetBridgeService after writing new shift data.</p>
     */
    @PluginMethod
    public void refresh(PluginCall call) {
        Intent intent = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        int[] ids = AppWidgetManager
                .getInstance(getContext())
                .getAppWidgetIds(new ComponentName(getContext(), ShiftWidgetProvider.class));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        getContext().sendBroadcast(intent);
        call.resolve();
    } /*end refresh*/

} /*end WidgetRefreshPlugin*/
