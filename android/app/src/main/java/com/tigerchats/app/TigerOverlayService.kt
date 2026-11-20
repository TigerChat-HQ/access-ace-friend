package com.tigerchats.app

import android.app.Service
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

/** Single circular TigerChat overlay. Shows the app logo when idle and sender avatar + unread badge on messages. */
class TigerOverlayService : Service() {
    private var windowManager: WindowManager? = null
    private var bubble: FrameLayout? = null
    private var avatar: ImageView? = null
    private var badge: TextView? = null
    private var panel: FrameLayout? = null
    private var panelWebView: WebView? = null
    private var bubbleLayoutParams: WindowManager.LayoutParams? = null
    private var miniWindowReady = false
    private var latestPath: String = "/chats"
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        val root = FrameLayout(this).apply {
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Color.rgb(0, 245, 165), Color.rgb(0, 130, 105))).apply {
                shape = GradientDrawable.OVAL
                setStroke(dp(2), Color.WHITE)
            }
            clipToOutline = true
            elevation = dp(12).toFloat()
            contentDescription = "Open TigerChat"
        }
        val image = ImageView(this).apply {
            setImageResource(R.drawable.tigerchats_logo)
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = oval(Color.rgb(0, 190, 135))
            clipToOutline = true
            contentDescription = "TigerChat"
        }
        root.addView(image, FrameLayout.LayoutParams(-1, -1))
        val count = TextView(this).apply {
            text = ""
            textSize = 10f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(dp(4), 0, dp(4), 0)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(20).toFloat()
                setColor(Color.rgb(220, 38, 38))
                setStroke(dp(1), Color.WHITE)
            }
            visibility = View.GONE
        }
        val badgeParams = FrameLayout.LayoutParams(-2, dp(19), Gravity.TOP or Gravity.END)
        root.addView(count, badgeParams)
        avatar = image
        badge = count
        root.setOnClickListener { toggleMiniWindow() }

        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else WindowManager.LayoutParams.TYPE_PHONE
        val initialSize = bubbleSizePx()
        val layout = WindowManager.LayoutParams(
            initialSize, initialSize, overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
            val width = resources.displayMetrics.widthPixels
            val height = resources.displayMetrics.heightPixels
            x = (prefs.getFloat(KEY_POSITION_X_RATIO, -1f).takeIf { it >= 0f }?.let { (it * (width - initialSize)).toInt() }
                ?: prefs.getInt(KEY_POSITION_X, dp(12))).coerceIn(0, (width - initialSize).coerceAtLeast(0))
            y = (prefs.getFloat(KEY_POSITION_Y_RATIO, -1f).takeIf { it >= 0f }?.let { (it * (height - initialSize)).toInt() }
                ?: prefs.getInt(KEY_POSITION_Y, dp(180))).coerceIn(0, (height - initialSize).coerceAtLeast(0))
        }
        bubbleLayoutParams = layout
        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        var dragged = false
        root.setOnTouchListener { target: View, event: MotionEvent ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX; downY = event.rawY
                    startX = layout.x; startY = layout.y
                    dragged = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - downX).toInt()
                    val dy = (event.rawY - downY).toInt()
                    if (abs(dx) > dp(4) || abs(dy) > dp(4)) dragged = true
                    val maxX = (resources.displayMetrics.widthPixels - layout.width).coerceAtLeast(0)
                    val maxY = (resources.displayMetrics.heightPixels - layout.height).coerceAtLeast(0)
                    layout.x = (startX + dx).coerceIn(0, maxX)
                    layout.y = (startY + dy).coerceIn(0, maxY)
                    try { windowManager?.updateViewLayout(target, layout) } catch (_: Exception) { }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (dragged) {
                        // Dock to the nearest horizontal edge and persist the final position.
                        val maxX = (resources.displayMetrics.widthPixels - layout.width).coerceAtLeast(0)
                        if (getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_SNAP, true)) {
                            layout.x = if (layout.x + layout.width / 2 < resources.displayMetrics.widthPixels / 2) 0 else maxX
                        }
                        layout.y = layout.y.coerceIn(0, (resources.displayMetrics.heightPixels - layout.height).coerceAtLeast(0))
                        try { windowManager?.updateViewLayout(target, layout) } catch (_: Exception) { }
                        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                            .putInt(KEY_POSITION_X, layout.x)
                            .putInt(KEY_POSITION_Y, layout.y)
                            .putFloat(KEY_POSITION_X_RATIO, layout.x.toFloat() / (resources.displayMetrics.widthPixels - layout.width).coerceAtLeast(1))
                            .putFloat(KEY_POSITION_Y_RATIO, layout.y.toFloat() / (resources.displayMetrics.heightPixels - layout.height).coerceAtLeast(1))
                            .apply()
                    } else if (abs(event.rawX - downX) < dp(8) && abs(event.rawY - downY) < dp(8)) {
                        target.performClick()
                    }
                    true
                }
                else -> false
            }
        }
        bubble = root
        applyBubbleAppearance()
        try { windowManager?.addView(root, layout) } catch (_: Exception) { stopSelf() }
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        updateUnread(prefs.getInt(KEY_UNREAD, 0))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_APPEARANCE) {
            applyBubbleAppearance()
            val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
            updateUnread(prefs.getInt(KEY_UNREAD, 0))
            if (!prefs.getBoolean(KEY_SHOW_AVATAR, true)) avatar?.setImageResource(R.drawable.tigerchats_logo)
        }
        if (intent?.action == ACTION_MESSAGE) {
            val count = intent.getIntExtra(EXTRA_UNREAD, 1)
            val avatarUrl = intent.getStringExtra(EXTRA_AVATAR).orEmpty()
            latestPath = safeMiniPath(intent.getStringExtra(EXTRA_PATH))
            updateUnread(count)
            val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
            if (prefs.getBoolean(KEY_SHOW_AVATAR, true) && avatarUrl.isNotBlank()) loadSenderAvatar(avatarUrl)
            if (prefs.getBoolean(KEY_AUTO_OPEN, false) && panel == null) toggleMiniWindow()
            navigateMiniWindow()
        }
        return START_STICKY
    }



    private fun bubbleSizePx(): Int {
        val size = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_SIZE, "normal")
        return dp(when (size) { "small" -> 52; "large" -> 76; else -> 64 })
    }

    private fun applyBubbleAppearance() {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val color = prefs.getString(KEY_COLOR, "primary") ?: "primary"
        val shape = prefs.getString(KEY_SHAPE, "circle") ?: "circle"
        val opacity = prefs.getInt(KEY_OPACITY, 100).coerceIn(50, 100) / 100f
        val colors = when (color) {
            "blue" -> intArrayOf(Color.rgb(96, 165, 250), Color.rgb(29, 78, 216))
            "purple" -> intArrayOf(Color.rgb(192, 132, 252), Color.rgb(107, 33, 168))
            "orange" -> intArrayOf(Color.rgb(251, 191, 36), Color.rgb(194, 65, 12))
            else -> intArrayOf(Color.rgb(0, 245, 165), Color.rgb(0, 130, 105))
        }
        val background = GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply {
            this.shape = if (shape == "rounded") GradientDrawable.RECTANGLE else GradientDrawable.OVAL
            cornerRadius = if (shape == "rounded") dp(20).toFloat() else dp(40).toFloat()
            setStroke(dp(2), Color.WHITE)
        }
        bubble?.let { view ->
            view.background = background
            view.alpha = opacity
        }
        avatar?.let { image ->
            image.background = GradientDrawable().apply {
                this.shape = if (shape == "rounded") GradientDrawable.RECTANGLE else GradientDrawable.OVAL
                cornerRadius = if (shape == "rounded") dp(16).toFloat() else dp(32).toFloat()
                setColor(colors[1])
            }
        }
        bubbleLayoutParams?.let { params ->
            val size = bubbleSizePx()
            params.width = size
            params.height = size
            params.x = params.x.coerceIn(0, (resources.displayMetrics.widthPixels - size).coerceAtLeast(0))
            params.y = params.y.coerceIn(0, (resources.displayMetrics.heightPixels - size).coerceAtLeast(0))
            try { bubble?.let { windowManager?.updateViewLayout(it, params) } } catch (_: Exception) { }
        }
    }

    private fun toggleMiniWindow() {
        if (panel != null) { closeMiniWindow(); return }
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        val root = FrameLayout(this).apply {
            background = GradientDrawable().apply { setColor(Color.rgb(10, 16, 20)); cornerRadius = dp(24).toFloat(); setStroke(dp(1), Color.rgb(0, 190, 135)) }
            clipToOutline = true
            elevation = dp(20).toFloat()
        }
        val header = FrameLayout(this).apply {
            background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(Color.rgb(0, 190, 135), Color.rgb(0, 130, 105)))
        }
        val title = TextView(this).apply {
            text = "TigerChat • ujumbe"; textSize = 15f; setTextColor(Color.BLACK)
            gravity = Gravity.CENTER_VERTICAL; setPadding(dp(14), 0, dp(8), 0)
        }
        header.addView(title, FrameLayout.LayoutParams(-1, dp(48)))
        val close = TextView(this).apply {
            text = "✕"; textSize = 20f; setTextColor(Color.BLACK); gravity = Gravity.CENTER
            setOnClickListener { closeMiniWindow() }
        }
        header.addView(close, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.END))
        root.addView(header, FrameLayout.LayoutParams(-1, dp(48), Gravity.TOP))
        val web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.safeBrowsingEnabled = true
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
                    val uri = request.url
                    return uri.scheme != "https" || uri.host != android.net.Uri.parse(SITE_URL).host
                }

                override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                    android.util.Log.e("TigerOverlay", "Mini chat renderer exited; closing overlay panel only")
                    if (panelWebView === view) closeMiniWindow()
                    return true
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (android.net.Uri.parse(url).host != android.net.Uri.parse(SITE_URL).host) return
                    miniWindowReady = true
                    navigateMiniWindow()
                }
            }
        }
        root.addView(web, FrameLayout.LayoutParams(-1, -1).apply { topMargin = dp(48) })
        val params = WindowManager.LayoutParams(
            (resources.displayMetrics.widthPixels - dp(24)).coerceAtLeast(dp(280)),
            (resources.displayMetrics.heightPixels * 0.76f).toInt().coerceAtMost(dp(720)),
            type, WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.CENTER; softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE }
        try {
            windowManager?.addView(root, params); panel = root; panelWebView = web
            miniWindowReady = false
            // Always load the SPA entry point first. Direct /chats and /post requests can
            // be rejected by static hosting before React Router gets a chance to handle them.
            web.loadUrl(SITE_URL + "/")
        } catch (error: Exception) {
            android.util.Log.e("TigerOverlay", "Could not open mini chat window", error); web.destroy()
        }
    }

    private fun closeMiniWindow() {
        panel?.let { try { windowManager?.removeView(it) } catch (_: Exception) { } }
        panelWebView?.apply { stopLoading(); loadUrl("about:blank"); destroy() }
        panel = null; panelWebView = null; miniWindowReady = false
    }

    private fun navigateMiniWindow() {
        val web = panelWebView ?: return
        if (!miniWindowReady) return
        val target = safeMiniPath(latestPath)
        val quotedTarget = JSONObject.quote(target)
        web.evaluateJavascript(
            "window.history.replaceState({}, '', $quotedTarget); window.dispatchEvent(new PopStateEvent('popstate'));",
            null,
        )
    }

    private fun safeMiniPath(raw: String?): String {
        val value = raw.orEmpty()
        val chatId = Regex("[?&]c=([0-9a-fA-F-]{36})").find(value)?.groupValues?.getOrNull(1)
        if (value.startsWith("/chats") && chatId != null) return "/chats?c=" + chatId + "&bubble=1"
        val postId = Regex("^/post/([0-9a-fA-F-]{36})").find(value)?.groupValues?.getOrNull(1)
        if (postId != null) return "/post/" + postId + "?bubble=1"
        return "/chats?bubble=1"
    }

    private fun updateUnread(count: Int) {
        mainHandler.post {
            val showBadge = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_SHOW_BADGE, true)
            badge?.apply {
                if (showBadge && count > 0) {
                    text = if (count > 99) "99+" else count.toString()
                    visibility = View.VISIBLE
                } else visibility = View.GONE
            }
        }
    }

    private fun loadSenderAvatar(rawUrl: String) {
        Thread {
            var connection: HttpURLConnection? = null
            try {
                val url = URL(rawUrl)
                if (url.protocol != "https") throw IllegalArgumentException("Avatar URL must use HTTPS")
                connection = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 5000
                    readTimeout = 5000
                    instanceFollowRedirects = false
                    setRequestProperty("Accept", "image/*")
                }
                val contentType = connection.contentType.orEmpty().lowercase()
                val contentLength = connection.contentLength.toLong()
                if (!contentType.startsWith("image/") || contentLength > 5L * 1024L * 1024L) {
                    throw IllegalArgumentException("Avatar response is not a supported small image")
                }
                connection.inputStream.use { stream ->
                    val bitmap = BitmapFactory.decodeStream(stream)
                    if (bitmap != null) mainHandler.post {
                        if (avatar != null && bubble != null) avatar?.setImageBitmap(bitmap)
                        else bitmap.recycle()
                    }
                }
            } catch (error: Exception) {
                android.util.Log.w("TigerOverlay", "Could not load sender avatar", error)
            } finally {
                connection?.disconnect()
            }
        }.start()
    }

    private fun oval(color: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
    }

    override fun onDestroy() {
        closeMiniWindow()
        bubble?.let { view -> try { windowManager?.removeView(view) } catch (_: Exception) { } }
        bubble = null; avatar = null; badge = null; windowManager = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val ACTION_MESSAGE = "com.tigerchats.app.OVERLAY_MESSAGE"
        const val ACTION_APPEARANCE = "com.tigerchats.app.OVERLAY_APPEARANCE"
        const val EXTRA_PATH = "notification_path"
        private const val SITE_URL = "https://tigerchat-hq.onrender.com"
        const val EXTRA_AVATAR = "avatar_url"
        const val EXTRA_UNREAD = "unread_count"
        const val PREFS = "tiger_overlay"
        const val KEY_ENABLED = "enabled"
        const val KEY_UNREAD = "unread_count"
        private const val KEY_POSITION_X = "bubble_position_x"
        private const val KEY_POSITION_Y = "bubble_position_y"
        private const val KEY_POSITION_X_RATIO = "bubble_position_x_ratio"
        private const val KEY_POSITION_Y_RATIO = "bubble_position_y_ratio"
        const val KEY_SIZE = "bubble_size"
        const val KEY_COLOR = "bubble_color"
        const val KEY_SHAPE = "bubble_shape"
        const val KEY_OPACITY = "bubble_opacity"
        const val KEY_SNAP = "bubble_snap"
        const val KEY_SHOW_BADGE = "bubble_show_badge"
        const val KEY_SHOW_AVATAR = "bubble_show_avatar"
        const val KEY_AUTO_OPEN = "bubble_auto_open"
    }
}
