package com.tigerchats.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.content.ContextCompat

class TigerChatOverlayBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val enabled = context.getSharedPreferences("tiger_overlay", Context.MODE_PRIVATE)
            .getBoolean("enabled", false)
        if (enabled && Settings.canDrawOverlays(context)) {
            ContextCompat.startForegroundService(context, Intent(context, TigerChatOverlayService::class.java))
        }
    }
}
