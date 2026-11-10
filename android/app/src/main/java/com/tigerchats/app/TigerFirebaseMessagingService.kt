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
        val conversationId = Regex("[?&]c=([^&]+)").find(path)?.groupValues?.getOrNull(1)
        val overlayEnabled = getSharedPreferences("tiger_overlay", Context.MODE_PRIVATE)
            .getBoolean("enabled", false) &&
            (Build.VERSION.SDK_INT < 23 || android.provider.Settings.canDrawOverlays(this))
        val useCustomOverlay = (kind == "message" || kind == "call") && overlayEnabled
        val canUseSystemBubble = kind == "message" && conversationId != null &&
            Build.VERSION.SDK_INT >= 30 && !useCustomOverlay

        if (useCustomOverlay) {
            val overlay = Intent(this, TigerChatOverlayService::class.java)
                .setAction(TigerChatOverlayService.ACTION_SHOW_NOTIFICATION)
                .putExtra(TigerChatOverlayService.EXTRA_TITLE, title)
                .putExtra(TigerChatOverlayService.EXTRA_BODY, body)
                .putExtra(TigerChatOverlayService.EXTRA_PATH, path)
                .putExtra(TigerChatOverlayService.EXTRA_AVATAR, data["avatar_url"] ?: "")
                .putExtra(TigerChatOverlayService.EXTRA_KIND, kind)
            try {
                androidx.core.content.ContextCompat.startForegroundService(this, overlay)
            } catch (_: Exception) {
                showStandardNotification(title, body, path, allowReply = kind == "message")
            }
        } else if (canUseSystemBubble) {
            try {
                showChatBubble(title, body, path, conversationId!!)
            } catch (_: Exception) {
                showStandardNotification(title, body, path)
            }
        } else {
            showStandardNotification(title, body, path)
        }
    }

    private fun ensureChannels(conversationId: String? = null, shortcutId: String? = null): String {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            val parent = NotificationChannel(CHANNEL_MESSAGES, "Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "New TIGERCHATS messages"
                if (Build.VERSION.SDK_INT >= 29) setAllowBubbles(true)
            }
            manager.createNotificationChannel(parent)
            if (Build.VERSION.SDK_INT >= 30 && conversationId != null && shortcutId != null) {
                val channelId = "chat_" + conversationId.hashCode().toUInt().toString(16)
                val conversation = NotificationChannel(channelId, "Chat", NotificationManager.IMPORTANCE_HIGH).apply {
                    setConversationId(CHANNEL_MESSAGES, shortcutId)
                    setAllowBubbles(true)
                }
                manager.createNotificationChannel(conversation)
                return channelId
            }
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

    private fun showChatBubble(title: String, body: String, path: String, conversationId: String) {
        val shortcutId = "chat_" + conversationId
        val target = Intent(this, BubbleActivity::class.java).putExtra("path", path)
        val requestCode = conversationId.hashCode()
        val bubbleIntent = PendingIntent.getActivity(this, requestCode, target, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
        val icon = Icon.createWithResource(this, R.drawable.ic_app)
        val person = Person.Builder().setName(title).setIcon(icon).build()

        if (Build.VERSION.SDK_INT >= 30) {
            val shortcut = ShortcutInfo.Builder(this, shortcutId)
                .setShortLabel(title.take(40))
                .setLongLabel(title)
                .setIcon(icon)
                .setIntent(target)
                .setPerson(person)
                .setLongLived(true)
                .build()
            getSystemService(android.content.pm.ShortcutManager::class.java).addDynamicShortcuts(listOf(shortcut))
        }

        val channelId = ensureChannels(conversationId, shortcutId)
        val bubble = NotificationCompat.BubbleMetadata.Builder(bubbleIntent, IconCompat.createWithResource(this, R.drawable.ic_app))
            .setDesiredHeight(640)
            .setAutoExpandBubble(false)
            .setSuppressNotification(false)
            .build()
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setShortcutId(shortcutId)
            .setBubbleMetadata(bubble)
            .setContentIntent(bubbleIntent)
            .addAction(quickReplyAction(path))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(requestCode, notification)
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
