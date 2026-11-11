package com.tigerchats.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.RemoteInput

class TigerQuickReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val text = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(KEY_TEXT_REPLY)
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() } ?: return
        val path = intent.getStringExtra(EXTRA_PATH) ?: return
        val conversationId = Regex("[?&]c=([0-9a-fA-F-]{36})")
            .find(path)?.groupValues?.getOrNull(1) ?: return

        val safePath = "/chats?c=$conversationId"
        val bubbleIntent = Intent(context, MainActivity::class.java)
            .putExtra("path", safePath)
            .putExtra(MainActivity.EXTRA_QUICK_REPLY, text)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        context.startActivity(bubbleIntent)
    }

    companion object {
        const val KEY_TEXT_REPLY = "tiger_quick_reply_text"
        const val EXTRA_PATH = "tiger_notification_path"
    }
}
