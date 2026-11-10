package com.tigerchats.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread
import kotlin.math.abs

class TigerChatOverlayService : Service() {
    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var chatWebView: WebView? = null
    private var expanded = false
    private var avatarView: ImageView? = null
    private var senderTitle = "TIGERCHATS"
    private var senderBody = "Ujumbe mpya"
    private var chatPath = "/chats"
    private var avatarUrl = ""
    private var panelWidth = 340
    private var panelHeight = 560
    private val mainHandler = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("tiger_overlay", MODE_PRIVATE) }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                prefs.edit().putBoolean("enabled", false).apply()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_DISMISS -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SHOW_NOTIFICATION -> {
                if (!prefs.getBoolean("enabled", false) || (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(this))) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                senderTitle = intent.getStringExtra(EXTRA_TITLE) ?: "TIGERCHATS"
                senderBody = intent.getStringExtra(EXTRA_BODY) ?: "Ujumbe mpya"
                chatPath = intent.getStringExtra(EXTRA_PATH) ?: "/chats"
                avatarUrl = intent.getStringExtra(EXTRA_AVATAR) ?: ""
                startForeground(NOTIFICATION_ID, buildNotification())
                if (expanded) {
                    updateExpandedHeader()
                } else {
                    showCollapsedBubble()
                }
                loadAvatar()
                return START_STICKY
            }
            else -> {
                // The service is notification-driven: enabling the feature never creates an idle bubble.
                if (!prefs.getBoolean("enabled", false)) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                return START_NOT_STICKY
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "Chat bubble", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Shows the TIGERCHATS bubble when a new notification arrives"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val openApp = PendingIntent.getActivity(
            this, 7101, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val dismiss = PendingIntent.getService(
            this, 7102, Intent(this, TigerChatOverlayService::class.java).setAction(ACTION_DISMISS),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(senderTitle)
            .setContentText(senderBody)
            .setContentIntent(openApp)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss bubble", dismiss)
            .setOngoing(false)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build()
    }

    private fun bubbleLayoutParams(): WindowManager.LayoutParams {
        val screen = resources.displayMetrics
        return WindowManager.LayoutParams(
            dp(prefs.getInt("bubble_size", 58)), dp(prefs.getInt("bubble_size", 58)),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = prefs.getInt("bubble_x", dp(12)).coerceIn(0, (screen.widthPixels - dp(58)).coerceAtLeast(0))
            y = prefs.getInt("bubble_y", dp(250)).coerceIn(0, (screen.heightPixels - dp(58)).coerceAtLeast(0))
        }
    }

    private fun showCollapsedBubble() {
        expanded = false
        chatWebView?.stopLoading()
        chatWebView?.destroy()
        chatWebView = null
        val size = dp(prefs.getInt("bubble_size", 58))
        val frame = FrameLayout(this)
        val avatar = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.rgb(0, 95, 63))
                setStroke(dp(2), Color.WHITE)
            }
            clipToOutline = true
            contentDescription = "Notification from $senderTitle"
        }
        frame.addView(avatar, FrameLayout.LayoutParams(-1, -1))
        avatarView = avatar
        frame.elevation = dp(10).toFloat()
        frame.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.rgb(0, 95, 63))
            setStroke(dp(2), Color.WHITE)
        }
        frame.setOnTouchListener(object : View.OnTouchListener {
            private var startX = 0f
            private var startY = 0f
            private var originX = 0
            private var originY = 0
            private var dragged = false
            override fun onTouch(view: View, event: MotionEvent): Boolean {
                val params = view.layoutParams as? WindowManager.LayoutParams ?: return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        startX = event.rawX
                        startY = event.rawY
                        originX = params.x
                        originY = params.y
                        dragged = false
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - startX).toInt()
                        val dy = (event.rawY - startY).toInt()
                        if (abs(dx) > dp(4) || abs(dy) > dp(4)) dragged = true
                        val maxX = (resources.displayMetrics.widthPixels - view.width).coerceAtLeast(0)
                        val maxY = (resources.displayMetrics.heightPixels - view.height).coerceAtLeast(0)
                        params.x = (originX + dx).coerceIn(0, maxX)
                        params.y = (originY + dy).coerceIn(0, maxY)
                        prefs.edit().putInt("bubble_x", params.x).putInt("bubble_y", params.y).apply()
                        windowManager.updateViewLayout(view, params)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (!dragged) showExpandedChat()
                        return true
                    }
                }
                return true
            }
        })
        attachView(frame, bubbleLayoutParams())
        if (avatarUrl.isNotBlank()) loadAvatar()
    }

    private fun loadAvatar() {
        if (avatarUrl.isBlank()) return
        val requestedUrl = avatarUrl
        thread(name = "tiger-avatar-load") {
            var bitmap: Bitmap? = null
            try {
                val connection = (URL(requestedUrl).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 5000
                    readTimeout = 5000
                    doInput = true
                }
                connection.inputStream.use { bitmap = BitmapFactory.decodeStream(it) }
                connection.disconnect()
            } catch (_: Exception) { }
            val result = bitmap
            if (result != null) mainHandler.post {
                if (requestedUrl == avatarUrl) {
                    avatarView?.setImageBitmap(result)
                    avatarView?.background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setStroke(dp(2), Color.WHITE)
                    }
                }
            }
        }
    }

    private fun showExpandedChat() {
        if (expanded) return
        expanded = true
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.rgb(12, 18, 17))
                cornerRadius = dp(20).toFloat()
                setStroke(dp(1), Color.rgb(0, 190, 115))
            }
            clipToOutline = true
            elevation = dp(14).toFloat()
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), dp(6), dp(6), dp(6))
            setBackgroundColor(Color.rgb(0, 95, 63))
        }
        val title = TextView(this).apply {
            text = senderTitle.take(18)
            textSize = 13f
            setTextColor(Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, dp(44), 1f)
            gravity = Gravity.CENTER_VERTICAL
            setOnTouchListener(dragPanelTouch())
        }
        fun control(label: String, action: () -> Unit): TextView = TextView(this).apply {
            text = label
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(dp(34), dp(40))
            setOnClickListener { action() }
        }
        header.addView(title)
        header.addView(control("S") { resizePanel(280, 420) })
        header.addView(control("M") { resizePanel(340, 560) })
        header.addView(control("L") { resizePanel(380, 640) })
        header.addView(control("−") { showCollapsedBubble() })
        header.addView(control("×") { stopSelf() })

        val web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient()
            addJavascriptInterface(object {
                @JavascriptInterface
                fun dismissChatNotification() { mainHandler.post { stopSelf() } }
            }, "TigerNative")
            setBackgroundColor(Color.rgb(12, 18, 17))
            loadUrl("https://tigerchat-hq.onrender.com" + safeChatPath(chatPath))
        }
        chatWebView = web
        panel.addView(header, LinearLayout.LayoutParams(-1, dp(52)))
        panel.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        attachView(panel, expandedLayoutParams())
    }

    private fun updateExpandedHeader() {
        // Keep the current chat open; the next notification updates the bubble's sender/avatar.
    }

    private fun safeChatPath(path: String): String =
        if (path.startsWith("/") && !path.startsWith("//")) path else "/chats"

    private fun resizePanel(width: Int, height: Int) {
        panelWidth = width
        panelHeight = height
        val params = overlayView?.layoutParams as? WindowManager.LayoutParams ?: return
        params.width = dp(width)
        params.height = dp(height)
        windowManager.updateViewLayout(overlayView, params)
    }

    private fun expandedLayoutParams(): WindowManager.LayoutParams =
        WindowManager.LayoutParams(
            dp(panelWidth), dp(panelHeight),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = prefs.getInt("panel_x", dp(10))
            y = prefs.getInt("panel_y", dp(90))
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

    private fun dragPanelTouch() = View.OnTouchListener {
        view, event ->
        val params = overlayView?.layoutParams as? WindowManager.LayoutParams ?: return@OnTouchListener false
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                view.setTag(R.id.panel_drag_origin, intArrayOf(event.rawX.toInt(), event.rawY.toInt(), params.x, params.y))
                true
            }
            MotionEvent.ACTION_MOVE -> {
                val origin = view.getTag(R.id.panel_drag_origin) as? IntArray ?: return@OnTouchListener false
                params.x = (origin[2] - (event.rawX.toInt() - origin[0])).coerceAtLeast(0)
                params.y = (origin[3] + (event.rawY.toInt() - origin[1])).coerceAtLeast(0)
                windowManager.updateViewLayout(overlayView, params)
                true
            }
            MotionEvent.ACTION_UP -> true
            else -> true
        }
    }

    private fun attachView(view: View, params: WindowManager.LayoutParams) {
        overlayView?.let { old -> try { windowManager.removeView(old) } catch (_: Exception) { } }
        overlayView = view
        windowManager.addView(view, params)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        overlayView?.let { try { windowManager.removeView(it) } catch (_: Exception) { } }
        overlayView = null
        chatWebView?.stopLoading()
        chatWebView?.destroy()
        chatWebView = null
        avatarView = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "com.tigerchats.app.STOP_CHAT_OVERLAY"
        const val ACTION_SHOW_NOTIFICATION = "com.tigerchats.app.SHOW_NOTIFICATION_BUBBLE"
        const val ACTION_DISMISS = "com.tigerchats.app.DISMISS_NOTIFICATION_BUBBLE"
        const val EXTRA_TITLE = "notification_title"
        const val EXTRA_BODY = "notification_body"
        const val EXTRA_PATH = "notification_path"
        const val EXTRA_AVATAR = "notification_avatar"
        private const val CHANNEL_ID = "tiger_chat_overlay"
        private const val NOTIFICATION_ID = 7310
    }
}
