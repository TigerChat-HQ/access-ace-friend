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
            background = oval(Color.rgb(0, 190, 135))
            clipToOutline = true
            elevation = dp(8).toFloat()
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
        val layout = WindowManager.LayoutParams(
            dp(58), dp(58), overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(12)
            y = dp(180)
        }
        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        root.setOnTouchListener { target: View, event: MotionEvent ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX; downY = event.rawY
                    startX = layout.x; startY = layout.y
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    layout.x = startX + (event.rawX - downX).toInt()
                    layout.y = startY + (event.rawY - downY).toInt()
                    try { windowManager?.updateViewLayout(target, layout) } catch (_: Exception) { }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (abs(event.rawX - downX) < dp(8) && abs(event.rawY - downY) < dp(8)) target.performClick()
                    true
                }
                else -> false
            }
        }
        bubble = root
        try { windowManager?.addView(root, layout) } catch (_: Exception) { stopSelf() }
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        updateUnread(prefs.getInt(KEY_UNREAD, 0))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_MESSAGE) {
            val count = intent.getIntExtra(EXTRA_UNREAD, 1)
            val avatarUrl = intent.getStringExtra(EXTRA_AVATAR).orEmpty()
            latestPath = safeMiniPath(intent.getStringExtra(EXTRA_PATH))
            updateUnread(count)
            if (avatarUrl.isNotBlank()) loadSenderAvatar(avatarUrl)
            navigateMiniWindow()
        }
        return START_STICKY
    }


    private fun toggleMiniWindow() {
        if (panel != null) { closeMiniWindow(); return }
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(12, 18, 17)); elevation = dp(16).toFloat() }
        val header = FrameLayout(this).apply { setBackgroundColor(Color.rgb(0, 190, 135)) }
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
            settings.javaScriptEnabled = true; settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            webViewClient = object : WebViewClient() {
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
            (resources.displayMetrics.heightPixels * 0.68f).toInt().coerceAtMost(dp(620)),
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
            badge?.apply {
                if (count > 0) {
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
                connection = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 5000
                    readTimeout = 5000
                    instanceFollowRedirects = true
                }
                connection.inputStream.use { stream ->
                    val bitmap = BitmapFactory.decodeStream(stream)
                    if (bitmap != null) mainHandler.post { avatar?.setImageBitmap(bitmap) }
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
        const val EXTRA_PATH = "notification_path"
        private const val SITE_URL = "https://tigerchat-hq.onrender.com"
        const val EXTRA_AVATAR = "avatar_url"
        const val EXTRA_UNREAD = "unread_count"
        const val PREFS = "tiger_overlay"
        const val KEY_ENABLED = "enabled"
        const val KEY_UNREAD = "unread_count"
    }
}
