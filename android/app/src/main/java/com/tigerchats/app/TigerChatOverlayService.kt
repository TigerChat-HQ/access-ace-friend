package com.tigerchats.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
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
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread
import kotlin.math.abs

class TigerChatOverlayService : Service() {
    private data class SafeBounds(val left: Int, val top: Int, val right: Int, val bottom: Int)

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var chatWebView: WebView? = null
    private var expanded = false
    private var avatarView: ImageView? = null
    private var expandedTitleView: TextView? = null
    private var senderTitle = "TIGERCHATS"
    private var senderBody = "Ujumbe mpya"
    private var chatPath = "/chats"
    private var avatarUrl = ""
    private var notificationKind = "message"
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
                notificationKind = intent.getStringExtra(EXTRA_KIND) ?: "message"
                startForeground(NOTIFICATION_ID, buildNotification())
                if (expanded) {
                    updateExpandedHeader()
                } else {
                    showCollapsedBubble()
                }
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
            this, chatPath.hashCode(), Intent(this, MainActivity::class.java)
                .putExtra("path", safeChatPath(chatPath))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val dismiss = PendingIntent.getService(
            this, 7102, Intent(this, TigerChatOverlayService::class.java).setAction(ACTION_DISMISS),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val replyIntent = Intent(this, TigerQuickReplyReceiver::class.java)
            .putExtra(TigerQuickReplyReceiver.EXTRA_PATH, safeChatPath(chatPath))
        val replyPendingIntent = PendingIntent.getBroadcast(
            this,
            chatPath.hashCode() xor 0x51A7,
            replyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
        val replyInput = RemoteInput.Builder(TigerQuickReplyReceiver.KEY_TEXT_REPLY)
            .setLabel("Reply to message")
            .build()
        val replyAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_send,
            "Reply",
            replyPendingIntent,
        ).addRemoteInput(replyInput)
            .setAllowGeneratedReplies(true)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
            .build()
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(senderTitle)
            .setContentText(senderBody)
            .setContentIntent(openApp)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss bubble", dismiss)
            .setOngoing(false)
            .setAutoCancel(true)
            .setCategory(if (notificationKind == "call") NotificationCompat.CATEGORY_CALL else NotificationCompat.CATEGORY_MESSAGE)
        if (notificationKind == "message") builder.addAction(replyAction)
        return builder.build()
    }

    private fun bubbleLayoutParams(): WindowManager.LayoutParams {
        val size = dp(prefs.getInt("bubble_size", 58))
        val bounds = safeBounds(size, size)
        return WindowManager.LayoutParams(
            size, size,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = prefs.getInt("bubble_x", bounds.right).coerceIn(bounds.left, bounds.right)
            y = prefs.getInt("bubble_y", bounds.top + dp(120)).coerceIn(bounds.top, bounds.bottom)
        }
    }

    private fun showCollapsedBubble() {
        val previousPanel = if (expanded) overlayView?.layoutParams as? WindowManager.LayoutParams else null
        previousPanel?.let(::saveCollapsedPositionFromPanel)
        expanded = false
        expandedTitleView = null
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
                        val slop = ViewConfiguration.get(this@TigerChatOverlayService).scaledTouchSlop
                        if (abs(dx) > slop || abs(dy) > slop) dragged = true
                        val bounds = safeBounds(params.width, params.height)
                        params.x = (originX + dx).coerceIn(bounds.left, bounds.right)
                        params.y = (originY + dy).coerceIn(bounds.top, bounds.bottom)
                        windowManager.updateViewLayout(view, params)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (dragged) snapToNearestEdge(view, params, isPanel = false) else showExpandedChat()
                        return true
                    }
                    MotionEvent.ACTION_CANCEL -> {
                        if (dragged) snapToNearestEdge(view, params, isPanel = false)
                        return true
                    }
                }
                return true
            }
        })
        attachView(frame, bubbleLayoutParams())
        loadAvatar()
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
        val header = BubbleHeaderView().apply {
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
        }
        expandedTitleView = title
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
            isFocusable = true
            isFocusableInTouchMode = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    val encodedPath = org.json.JSONObject.quote(safeChatPath(chatPath))
                    view.evaluateJavascript(
                        "window.__tigerPendingNativePath = $encodedPath; window.dispatchEvent(new CustomEvent('tiger:native-navigate',{detail:$encodedPath}));",
                        null,
                    )
                }
            }
            addJavascriptInterface(object {
                @JavascriptInterface
                fun dismissChatNotification() { mainHandler.post { stopSelf() } }
            }, "TigerNative")
            setBackgroundColor(Color.rgb(12, 18, 17))
            loadUrl("https://tigerchat-hq.onrender.com/")
        }
        chatWebView = web
        panel.addView(header, LinearLayout.LayoutParams(-1, dp(52)))
        panel.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        ViewCompat.setOnApplyWindowInsetsListener(panel) { _, insets ->
            val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val screenHeight = screenSize().second
            val availableHeight = (screenHeight - bars.top - bars.bottom - dp(16) - imeBottom).coerceAtLeast(dp(240))
            val targetHeight = if (imeBottom > 0) minOf(dp(panelHeight), availableHeight)
                else safePanelDimensions(dp(panelWidth), dp(panelHeight)).second
            val params = overlayView?.layoutParams as? WindowManager.LayoutParams
            if (params != null && params.height != targetHeight) {
                params.height = targetHeight
                params.y = params.y.coerceAtMost((screenHeight - targetHeight - dp(8)).coerceAtLeast(dp(8)))
                try { windowManager.updateViewLayout(overlayView, params) } catch (_: Exception) { }
            }
            insets
        }
        attachView(panel, expandedLayoutParams())
        ViewCompat.requestApplyInsets(panel)
        ViewCompat.requestApplyInsets(web)
        web.requestFocus()
    }

    private fun updateExpandedHeader() {
        expandedTitleView?.text = senderTitle.take(18)
    }

    private fun safeChatPath(path: String): String =
        if (path.startsWith("/") && !path.startsWith("//")) path else "/chats"

    private fun resizePanel(width: Int, height: Int) {
        panelWidth = width
        panelHeight = height
        val params = overlayView?.layoutParams as? WindowManager.LayoutParams ?: return
        val dimensions = safePanelDimensions(dp(width), dp(height))
        params.width = dimensions.first
        params.height = dimensions.second
        clampToSafeBounds(params)
        windowManager.updateViewLayout(overlayView, params)
        savePanelPosition(params)
    }

    private fun expandedLayoutParams(): WindowManager.LayoutParams {
        val dimensions = safePanelDimensions(dp(panelWidth), dp(panelHeight))
        val bounds = safeBounds(dimensions.first, dimensions.second)
        val screenWidth = screenSize().first
        val bubbleSize = dp(prefs.getInt("bubble_size", 58))
        val bubbleX = prefs.getInt("bubble_x", bounds.right)
        val defaultX = if (bubbleX + bubbleSize / 2 < screenWidth / 2) bounds.left else bounds.right
        val bubbleY = prefs.getInt("bubble_y", bounds.top + dp(120))
        return WindowManager.LayoutParams(
            dimensions.first, dimensions.second,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = prefs.getInt("panel_x", defaultX).coerceIn(bounds.left, bounds.right)
            y = prefs.getInt("panel_y", bubbleY).coerceIn(bounds.top, bounds.bottom)
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }
    }

    private inner class BubbleHeaderView : LinearLayout(this@TigerChatOverlayService) {
        private var startRawX = 0f
        private var startRawY = 0f
        private var startPanelX = 0
        private var startPanelY = 0
        private var dragging = false

        init {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            isClickable = true
        }

        override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startRawX = event.rawX
                    startRawY = event.rawY
                    val params = overlayView?.layoutParams as? WindowManager.LayoutParams
                    startPanelX = params?.x ?: 0
                    startPanelY = params?.y ?: 0
                    dragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val slop = ViewConfiguration.get(this@TigerChatOverlayService).scaledTouchSlop
                    if (!dragging && (abs(event.rawX - startRawX) > slop || abs(event.rawY - startRawY) > slop)) {
                        dragging = true
                        return true
                    }
                }
            }
            return false
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            val panel = overlayView ?: return false
            val params = panel.layoutParams as? WindowManager.LayoutParams ?: return false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> return true
                MotionEvent.ACTION_MOVE -> {
                    if (dragging) {
                        val bounds = safeBounds(params.width, params.height)
                        params.x = (startPanelX + (event.rawX - startRawX).toInt()).coerceIn(bounds.left, bounds.right)
                        params.y = (startPanelY + (event.rawY - startRawY).toInt()).coerceIn(bounds.top, bounds.bottom)
                        try { windowManager.updateViewLayout(panel, params) } catch (_: Exception) { }
                    }
                    return true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (dragging) snapToNearestEdge(panel, params, isPanel = true)
                    else savePanelPosition(params)
                    dragging = false
                    return true
                }
            }
            return true
        }
    }

    private fun saveCollapsedPositionFromPanel(panel: WindowManager.LayoutParams) {
        val size = dp(prefs.getInt("bubble_size", 58))
        val bounds = safeBounds(size, size)
        val screenWidth = screenSize().first
        val dockX = if (panel.x + panel.width / 2 < screenWidth / 2) bounds.left else bounds.right
        val y = panel.y.coerceIn(bounds.top, bounds.bottom)
        prefs.edit().putInt("bubble_x", dockX).putInt("bubble_y", y).apply()
    }

    private fun snapToNearestEdge(view: View, params: WindowManager.LayoutParams, isPanel: Boolean) {
        val bounds = safeBounds(params.width, params.height)
        val screenWidth = screenSize().first
        val dockX = if (params.x + params.width / 2 < screenWidth / 2) bounds.left else bounds.right
        ValueAnimator.ofInt(params.x, dockX).apply {
            duration = 180L
            interpolator = DecelerateInterpolator()
            addUpdateListener { animator ->
                params.x = (animator.animatedValue as Int).coerceIn(bounds.left, bounds.right)
                try {
                    if (view.parent != null) windowManager.updateViewLayout(view, params)
                } catch (_: Exception) { }
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    if (isPanel) savePanelPosition(params) else saveBubblePosition(params)
                }
            })
            start()
        }
    }

    private fun savePanelPosition(params: WindowManager.LayoutParams) {
        prefs.edit().putInt("panel_x", params.x).putInt("panel_y", params.y).apply()
    }

    private fun saveBubblePosition(params: WindowManager.LayoutParams) {
        prefs.edit().putInt("bubble_x", params.x).putInt("bubble_y", params.y).apply()
    }

    private fun clampToSafeBounds(params: WindowManager.LayoutParams) {
        val bounds = safeBounds(params.width, params.height)
        params.x = params.x.coerceIn(bounds.left, bounds.right)
        params.y = params.y.coerceIn(bounds.top, bounds.bottom)
    }

    private fun safePanelDimensions(width: Int, height: Int): Pair<Int, Int> {
        val screen = screenSize()
        val margin = dp(8)
        val top = systemBarHeight("status_bar_height", dp(24)) + margin
        val bottom = systemBarHeight("navigation_bar_height", dp(24)) + margin
        return (width.coerceAtMost((screen.first - margin * 2).coerceAtLeast(dp(1)))) to
            (height.coerceAtMost((screen.second - top - bottom).coerceAtLeast(dp(1))))
    }

    private fun safeBounds(width: Int, height: Int): SafeBounds {
        val screen = screenSize()
        val margin = dp(8)
        val topInset = systemBarHeight("status_bar_height", dp(24)) + margin
        val bottomInset = systemBarHeight("navigation_bar_height", dp(24)) + margin
        val top = topInset.coerceAtMost((screen.second - height).coerceAtLeast(0))
        return SafeBounds(
            left = margin.coerceAtMost((screen.first - width).coerceAtLeast(0)),
            top = top,
            right = (screen.first - width - margin).coerceAtLeast(margin),
            bottom = (screen.second - height - bottomInset).coerceAtLeast(top)
        )
    }

    @Suppress("DEPRECATION")
    private fun screenSize(): Pair<Int, Int> {
        if (Build.VERSION.SDK_INT >= 30) {
            val bounds = windowManager.maximumWindowMetrics.bounds
            return bounds.width() to bounds.height()
        }
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics)
        return metrics.widthPixels to metrics.heightPixels
    }

    private fun systemBarHeight(name: String, fallback: Int): Int {
        val resourceId = resources.getIdentifier(name, "dimen", "android")
        return if (resourceId > 0) resources.getDimensionPixelSize(resourceId) else fallback
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
        expandedTitleView = null
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
        const val EXTRA_KIND = "notification_kind"
        private const val CHANNEL_ID = "tiger_chat_overlay"
        private const val NOTIFICATION_ID = 7310
    }
}
