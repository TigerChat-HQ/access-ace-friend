package com.tigerchats.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Native message notifications.
 *
 * On Android 10+ message notifications are published as conversation bubbles when
 * the OS, app notification settings and conversation shortcut permit it. Android
 * remains free to fall back to a normal notification when bubbles are disabled.
 */
class TigerFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences("tiger_native", Context.MODE_PRIVATE)
            .edit().putString("fcm_token", token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"]?.takeIf { it.isNotBlank() } ?: "TIGERCHATS"
        val body = data["body"]?.takeIf { it.isNotBlank() } ?: "You have a new message"
        val path = safeNotificationPath(data["path"])
        val kind = data["kind"] ?: "message"
        val overlayEnabled = kind == "message" && getSharedPreferences(TigerOverlayService.PREFS, Context.MODE_PRIVATE)
            .getBoolean(TigerOverlayService.KEY_ENABLED, false)
        if (overlayEnabled) {
            val prefs = getSharedPreferences(TigerOverlayService.PREFS, Context.MODE_PRIVATE)
            val unread = prefs.getInt(TigerOverlayService.KEY_UNREAD, 0) + 1
            prefs.edit().putInt(TigerOverlayService.KEY_UNREAD, unread).apply()
            try {
                startService(Intent(this, TigerOverlayService::class.java).apply {
                    action = TigerOverlayService.ACTION_MESSAGE
                    putExtra(TigerOverlayService.EXTRA_AVATAR, data["avatar_url"].orEmpty())
                    putExtra(TigerOverlayService.EXTRA_UNREAD, unread)
                    putExtra(TigerOverlayService.EXTRA_PATH, path)
                })
            } catch (error: Exception) {
                android.util.Log.w(TAG, "Could not update overlay bubble", error)
            }
        }
        showMessageNotification(title, body, path, kind == "message")
    }

    private fun safeNotificationPath(rawPath: String?): String {
        val candidate = rawPath?.takeIf { it.startsWith("/") && !it.startsWith("//") } ?: "/chats"
        val conversationId = Regex("[?&]c=([0-9a-fA-F-]{36})").find(candidate)?.groupValues?.getOrNull(1)
        if (candidate.startsWith("/chats") && conversationId != null) return "/chats?c=$conversationId"
        val postId = Regex("^/post/([0-9a-fA-F-]{36})").find(candidate)?.groupValues?.getOrNull(1)
        if (postId != null) return "/post/$postId"
        return "/chats"
    }

    private fun ensureMessageChannel(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = android.app.NotificationChannel(
                CHANNEL_MESSAGES,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "New TIGERCHATS messages"
                lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
                setAllowBubbles(false)
            }
            manager.createNotificationChannel(channel)
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

    private fun showMessageNotification(title: String, body: String, path: String, allowReply: Boolean) {
        val openIntent = Intent(this, MainActivity::class.java)
            .putExtra("path", path)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            path.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val sender = Person.Builder().setName(title).build()
        val style = NotificationCompat.MessagingStyle(sender)
            .setConversationTitle(title)
            .addMessage(body, System.currentTimeMillis(), sender)

        val builder = NotificationCompat.Builder(this, ensureMessageChannel())
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(style)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(contentPendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOnlyAlertOnce(false)

        if (allowReply) builder.addAction(quickReplyAction(path))

        // The floating overlay is the only bubble UI. This remains a normal
        // notification fallback; Android conversation bubbles are not published.
        getSystemService(NotificationManager::class.java)
            .notify(path.hashCode(), builder.build())
    }

    companion object {
        private const val TAG = "TigerChatPush"
        private const val CHANNEL_MESSAGES = "messages_bubble_only_v2"
        private const val SHORTCUT_CATEGORY = "com.tigerchats.app.category.CONVERSATION"
    }
}
