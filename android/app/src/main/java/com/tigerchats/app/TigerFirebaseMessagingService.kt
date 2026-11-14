package com.tigerchats.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.graphics.drawable.IconCompat
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
        val path = safeConversationPath(data["path"])
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
                })
            } catch (error: Exception) {
                android.util.Log.w(TAG, "Could not update overlay bubble", error)
            }
        }
        showMessageNotification(title, body, path, kind == "message", overlayEnabled)
    }

    private fun safeConversationPath(rawPath: String?): String {
        val candidate = rawPath?.takeIf { it.startsWith("/") && !it.startsWith("//") } ?: "/chats"
        val conversationId = Regex("[?&]c=([0-9a-fA-F-]{36})")
            .find(candidate)?.groupValues?.getOrNull(1) ?: return "/chats"
        return "/chats?c=$conversationId"
    }

    private fun ensureMessageChannel(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_MESSAGES,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "New TIGERCHATS conversations"
                lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) setAllowBubbles(true)
            }
            manager.createNotificationChannel(channel)
        }
        return CHANNEL_MESSAGES
    }

    private fun conversationShortcutId(path: String): String? =
        Regex("[?&]c=([0-9a-fA-F-]{36})")
            .find(path)?.groupValues?.getOrNull(1)?.let { "tiger-chat-$it" }

    private fun createConversationShortcut(title: String, path: String): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        val shortcutId = conversationShortcutId(path) ?: return null
        val conversationId = shortcutId.removePrefix("tiger-chat-")
        val launchIntent = Intent(this, MainActivity::class.java)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("tigerchats://chat?c=$conversationId"))
            .putExtra("path", path)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

        val person = android.app.Person.Builder()
            .setName(title)
            .setIcon(Icon.createWithResource(this, R.drawable.tigerchats_logo))
            .build()
        val shortcutBuilder = ShortcutInfo.Builder(this, shortcutId)
            .setShortLabel(title.take(25).ifBlank { "TigerChat" })
            .setLongLabel("Chat with $title")
            .setIcon(Icon.createWithResource(this, R.drawable.tigerchats_logo))
            .setIntent(launchIntent)
            .setPerson(person)
            .setCategories(setOf(SHORTCUT_CATEGORY))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            shortcutBuilder.setLongLived(true)
        }
        return try {
            getSystemService(ShortcutManager::class.java)
                .pushDynamicShortcut(shortcutBuilder.build())
            shortcutId
        } catch (error: Exception) {
            android.util.Log.w(TAG, "Could not publish conversation shortcut", error)
            null
        }
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

    private fun showMessageNotification(title: String, body: String, path: String, allowReply: Boolean, overlayEnabled: Boolean) {
        val conversationId = conversationShortcutId(path)?.removePrefix("tiger-chat-")
        val openIntent = Intent(this, MainActivity::class.java)
            .putExtra("path", path)
            .apply {
                if (conversationId != null) {
                    action = Intent.ACTION_VIEW
                    data = Uri.parse("tigerchats://chat?c=$conversationId")
                }
            }
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

        val shortcutId = if (allowReply) createConversationShortcut(title, path) else null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && shortcutId != null && !overlayEnabled) {
            val bubbleIntent = Intent(openIntent)
            val bubblePendingIntent = PendingIntent.getActivity(
                this,
                shortcutId.hashCode(),
                bubbleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val bubble = NotificationCompat.BubbleMetadata.Builder(
                bubblePendingIntent,
                IconCompat.createWithResource(this, R.drawable.tigerchats_logo),
            )
                .setDesiredHeight(640)
                .setAutoExpandBubble(false)
                .setSuppressNotification(false)
                .build()
            builder.setShortcutId(shortcutId).setBubbleMetadata(bubble)
        }

        getSystemService(NotificationManager::class.java)
            .notify(path.hashCode(), builder.build())
    }

    companion object {
        private const val TAG = "TigerChatPush"
        private const val CHANNEL_MESSAGES = "messages"
        private const val SHORTCUT_CATEGORY = "com.tigerchats.app.category.CONVERSATION"
    }
}
