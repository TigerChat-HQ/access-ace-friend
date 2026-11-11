package com.tigerchats.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.graphics.drawable.Icon
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import android.app.Person
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class TigerFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences("tiger_native", Context.MODE_PRIVATE).edit().putString("fcm_token", token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"] ?: "TIGERCHATS"
        val body = data["body"] ?: "You have a new message"
        val path = data["path"] ?: "/chats"
        val kind = data["kind"] ?: "message"
        showStandardNotification(title, body, path, allowReply = kind == "message")
    }

    private fun ensureChannels(): String {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_MESSAGES, "Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "New TIGERCHATS messages"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return CHANNEL_MESSAGES
    }

    private fun quickReplyAction(path: String): NotificationCompat.Action {
        val replyIntent = Intent(this, TigerQuickReplyReceiver::class.java)
            .putExtra(TigerQuickReplyReceiver.EXTRA_PATH, path)
        val replyPendingIntent = PendingIntent.getBroadcast(
            this,
            path.hashCode() xor 0x51A7,
            replyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
        val remoteInput = RemoteInput.Builder(TigerQuickReplyReceiver.KEY_TEXT_REPLY)
            .setLabel("Reply to message")
            .build()
        return NotificationCompat.Action.Builder(android.R.drawable.ic_menu_send, "Reply", replyPendingIntent)
            .addRemoteInput(remoteInput)
            .setAllowGeneratedReplies(true)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
            .build()
    }

    private fun showStandardNotification(title: String, body: String, path: String, allowReply: Boolean = true) {
        val intent = Intent(this, MainActivity::class.java).putExtra("path", path).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(this, path.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val replyAction = quickReplyAction(path)
        val notification = NotificationCompat.Builder(this, ensureChannels())
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pending)
            .apply { if (allowReply) addAction(replyAction) }
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        getSystemService(NotificationManager::class.java).notify(path.hashCode(), notification)
    }

    companion object {
        private const val CHANNEL_MESSAGES = "messages"
    }
}
