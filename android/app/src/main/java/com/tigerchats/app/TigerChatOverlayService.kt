package com.tigerchats.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class TigerChatOverlayService : Service() {
    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var chatWebView: WebView? = null
    private var expanded = false
    private var windowX = 16
    private var windowY = 220

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            getSharedPreferences("tiger_overlay", MODE_PRIVATE).edit().putBoolean("enabled", false).apply()
            stopSelf()
            return START_NOT_STICKY
        }
        if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(this)) {
            getSharedPreferences("tiger_overlay", MODE_PRIVATE).edit().putBoolean("enabled", false).apply()
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, buildNotification())
        if (overlayView == null) showCollapsedBubble()
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "Chat bubble", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps your TIGERCHATS floating chat available"
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
        val stop = PendingIntent.getService(
            this, 7102, Intent(this, TigerChatOverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("TIGERCHATS chat bubble is active")
            .setContentText("Floating chat is available over other apps")
            .setContentIntent(openApp)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Turn off", stop)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun bubbleLayoutParams(): WindowManager.LayoutParams =
        WindowManager.LayoutParams(
            dp(58), dp(58),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = windowX
            y = windowY
        }

    private fun expandedLayoutParams(): WindowManager.LayoutParams =
        WindowManager.LayoutParams(
            dp(340), dp(560),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = dp(10)
            y = dp(90)
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

    private fun showCollapsedBubble() {
        expanded = false
        val bubble = TextView(this).apply {
            text = "T"
            textSize = 23f
            setTextColor(Color.BLACK)
            gravity = Gravity.CENTER
            elevation = dp(10).toFloat()
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.rgb(0, 230, 138))
                setStroke(dp(2), Color.WHITE)
            }
            contentDescription = "Open TIGERCHATS floating chat"
            setOnClickListener { showExpandedChat() }
        }
        bubble.setOnTouchListener(object : View.OnTouchListener {
            private var startX = 0f
            private var startY = 0f
            private var originX = 0
            private var originY = 0
            private var dragged = false
            override fun onTouch(view: View, event: MotionEvent): Boolean {
                val params = overlayView?.layoutParams as? WindowManager.LayoutParams ?: return false
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
                        if (kotlin.math.abs(dx) > dp(5) || kotlin.math.abs(dy) > dp(5)) dragged = true
                        params.x = (originX + dx).coerceAtLeast(0)
                        params.y = (originY + dy).coerceAtLeast(0)
                        windowX = params.x
                        windowY = params.y
                        windowManager.updateViewLayout(view, params)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (!dragged) showExpandedChat()
                        return true
                    }
                }
                return false
            }
        })
        attachView(bubble, bubbleLayoutParams())
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
            setPadding(dp(12), dp(8), dp(8), dp(8))
            setBackgroundColor(Color.rgb(0, 95, 63))
        }
        val title = TextView(this).apply {
            text = "TIGERCHATS"
            textSize = 14f
            setTextColor(Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f)
            gravity = Gravity.CENTER_VERTICAL
        }
        val minimize = TextView(this).apply {
            text = "−"
            textSize = 25f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(dp(42), dp(42))
            setOnClickListener { showCollapsedBubble() }
        }
        val close = TextView(this).apply {
            text = "×"
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(dp(42), dp(42))
            setOnClickListener {
                getSharedPreferences("tiger_overlay", MODE_PRIVATE).edit().putBoolean("enabled", false).apply()
                stopSelf()
            }
        }
        header.addView(title)
        header.addView(minimize)
        header.addView(close)

        val web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient()
            setBackgroundColor(Color.rgb(12, 18, 17))
            loadUrl("https://tigerchat-hq.onrender.com/chats?bubble=1")
        }
        chatWebView = web
        panel.addView(header, LinearLayout.LayoutParams(-1, dp(58)))
        panel.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        attachView(panel, expandedLayoutParams())
    }

    private fun attachView(view: View, params: WindowManager.LayoutParams) {
        overlayView?.let { old ->
            try { windowManager.removeView(old) } catch (_: Exception) { }
        }
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
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "com.tigerchats.app.STOP_CHAT_OVERLAY"
        private const val CHANNEL_ID = "tiger_chat_overlay"
        private const val NOTIFICATION_ID = 7310
    }
}
