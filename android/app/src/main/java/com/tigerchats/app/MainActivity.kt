package com.tigerchats.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.WindowManager
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

open class MainActivity : Activity() {
    protected lateinit var webView: WebView
    private val siteUrl = "https://tigerchat-hq.onrender.com"
    private var pendingPath = "/"
    private var pendingQuickReply: String? = null
    private var pageLoaded = false
    private var pendingMediaPermissionRequest: PermissionRequest? = null
    private var pendingMediaAndroidPermissions: Array<String> = emptyArray()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Keep the WebView inside the decor's system-bar bounds and let Android resize
        // its actual viewport for the IME. Do not also add IME padding to the WebView:
        // that double-adjusts the viewport and can push the chat composer below the keyboard.
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        requestNotificationPermission()
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == "tigerchat-hq.onrender.com") return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString())))
                    true
                } catch (_: Exception) {
                    true
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (Uri.parse(url).host != Uri.parse(siteUrl).host) return
                pageLoaded = true
                applyNativeViewportHeight(view)
                applyPendingPath(view)
                deliverPendingQuickReply(view)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val origin = request.origin
                    if (origin.scheme != "https" || origin.host != "tigerchat-hq.onrender.com") {
                        request.deny()
                        return@runOnUiThread
                    }

                    val requested = request.resources.toSet()
                    val androidPermissions = buildList {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested) add(Manifest.permission.RECORD_AUDIO)
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested) add(Manifest.permission.CAMERA)
                    }.toTypedArray()
                    if (androidPermissions.isEmpty()) {
                        request.deny()
                        return@runOnUiThread
                    }

                    pendingMediaPermissionRequest?.let { previous ->
                        try { previous.deny() } catch (_: Exception) { }
                    }
                    pendingMediaPermissionRequest = request
                    pendingMediaAndroidPermissions = androidPermissions
                    val missing = androidPermissions.filter {
                        ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED
                    }
                    if (missing.isEmpty()) {
                        grantWebMediaPermission(request, requested)
                    } else {
                        ActivityCompat.requestPermissions(
                            this@MainActivity,
                            missing.toTypedArray(),
                            MEDIA_PERMISSION_REQUEST_CODE,
                        )
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingMediaPermissionRequest === request) {
                    pendingMediaPermissionRequest = null
                    pendingMediaAndroidPermissions = emptyArray()
                }
            }
        }
        webView.addJavascriptInterface(NativeBridge(), "TigerNative")
        setContentView(webView)
        // Use Android's measured WebView height as the authoritative viewport while the IME resizes the Activity.
        webView.addOnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->
            applyNativeViewportHeight(view)
        }
        pendingPath = safePath(intent?.getStringExtra("path"))
        pendingQuickReply = intent?.getStringExtra(EXTRA_QUICK_REPLY)
        webView.loadUrl(siteUrl + "/")
        warmFirebaseToken()
    }

    private fun grantWebMediaPermission(request: PermissionRequest, requested: Set<String>) {
        val allowed = request.resources.filter { resource ->
            when (resource) {
                PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                    ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                else -> false
            }
        }.toTypedArray()
        try {
            if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
        } catch (_: Exception) {
            // The WebView may have navigated away while the Android permission dialog was open.
        } finally {
            if (pendingMediaPermissionRequest === request) {
                pendingMediaPermissionRequest = null
                pendingMediaAndroidPermissions = emptyArray()
            }
        }
    }

    @Deprecated("Deprecated in Android API")
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != MEDIA_PERMISSION_REQUEST_CODE) return
        val request = pendingMediaPermissionRequest ?: return
        val allGranted = pendingMediaAndroidPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
        if (allGranted) grantWebMediaPermission(request, request.resources.toSet())
        else {
            try { request.deny() } catch (_: Exception) { }
            pendingMediaPermissionRequest = null
            pendingMediaAndroidPermissions = emptyArray()
            showMediaPermissionSettingsPrompt()
        }
    }

    private fun showMediaPermissionSettingsPrompt() {
        if (isFinishing || isDestroyed) return
        AlertDialog.Builder(this)
            .setTitle("Camera and microphone permission")
            .setMessage("TigerChat needs microphone access for voice calls and camera plus microphone access for video calls. Enable the required permissions in Android app settings, then try again.")
            .setNegativeButton("Not now", null)
            .setPositiveButton("Open settings") { _, _ ->
                val settingsIntent = Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:$packageName"),
                )
                startActivity(settingsIntent)
            }
            .show()
    }

    private fun applyNativeViewportHeight(view: WebView) {
        val heightDp = view.height / resources.displayMetrics.density
        if (heightDp <= 0f) return
        val height = String.format(java.util.Locale.US, "%.2f", heightDp)
        view.post {
            if (!isFinishing && !isDestroyed) {
                view.evaluateJavascript(
                    "document.documentElement.style.setProperty('--tiger-viewport-height', '" + height + "px')",
                    null,
                )
            }
        }
    }
    private fun deliverPendingQuickReply(view: WebView) {
        val reply = pendingQuickReply?.takeIf { it.isNotBlank() } ?: return
        val conversationId = Regex("[?&]c=([0-9a-fA-F-]{36})")
            .find(pendingPath)?.groupValues?.getOrNull(1) ?: return
        val payload = org.json.JSONObject()
            .put("text", reply)
            .put("conversationId", conversationId)
        view.evaluateJavascript(
            "window.__tigerQuickReply = $payload; window.dispatchEvent(new CustomEvent('tiger:native-quick-reply',{detail:$payload}));",
            null,
        )
        pendingQuickReply = null
        intent?.removeExtra(EXTRA_QUICK_REPLY)
    }

    private fun safePath(path: String?): String =
        path?.takeIf { it.startsWith("/") && !it.startsWith("//") } ?: "/"

    private fun applyPendingPath(view: WebView) {
        val encodedPath = org.json.JSONObject.quote(pendingPath)
        view.evaluateJavascript(
            "window.__tigerPendingNativePath = $encodedPath; window.dispatchEvent(new CustomEvent('tiger:native-navigate',{detail:$encodedPath}));",
            null,
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingPath = safePath(intent.getStringExtra("path") ?: pendingPath)
        intent.getStringExtra(EXTRA_QUICK_REPLY)?.takeIf { it.isNotBlank() }?.let {
            pendingQuickReply = it
        }
        if (!::webView.isInitialized) return
        if (pageLoaded) {
            applyPendingPath(webView)
            deliverPendingQuickReply(webView)
        } else {
            webView.loadUrl(siteUrl + "/")
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7301)
        }
    }

    private fun syncChatOverlayService() {
        val enabled = getSharedPreferences("tiger_overlay", MODE_PRIVATE).getBoolean("enabled", false)
        if (enabled && Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) {
            getSharedPreferences("tiger_overlay", MODE_PRIVATE).edit().putBoolean("enabled", false).apply()
        }
    }

    private fun warmFirebaseToken() {
        val prefs = getSharedPreferences("tiger_native", MODE_PRIVATE)
        try {
            val app = FirebaseApp.initializeApp(this)
            if (app == null) {
                prefs.edit().putString("fcm_status", "Firebase initialization failed: default app is missing").apply()
                return
            }
            prefs.edit().putString("fcm_status", "Requesting Firebase Messaging token").apply()
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    if (token.isBlank()) {
                        prefs.edit().putString("fcm_status", "Firebase returned an empty token").apply()
                        return@addOnSuccessListener
                    }
                    prefs.edit()
                        .putString("fcm_token", token)
                        .putString("fcm_status", "ready")
                        .apply()
                    publishTokenToWeb(token)
                }
                .addOnFailureListener { error ->
                    val detail = error.message?.take(180) ?: error.javaClass.simpleName
                    prefs.edit().putString("fcm_status", "Token request failed: $detail").apply()
                }
        } catch (error: Exception) {
            val detail = error.message?.take(180) ?: error.javaClass.simpleName
            prefs.edit().putString("fcm_status", "Firebase setup failed: $detail").apply()
        }
    }

    override fun onResume() {
        super.onResume()
        warmFirebaseToken()
        syncChatOverlayService()
    }

    override fun onDestroy() {
        pendingMediaPermissionRequest?.let { try { it.deny() } catch (_: Exception) { } }
        pendingMediaPermissionRequest = null
        super.onDestroy()
    }

    private fun publishTokenToWeb(token: String) {
        if (!::webView.isInitialized) return
        val encoded = org.json.JSONObject.quote(token)
        webView.post { webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('tiger:native-fcm-token',{detail:$encoded}))", null) }
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun getFcmToken(): String = getSharedPreferences("tiger_native", MODE_PRIVATE).getString("fcm_token", "") ?: ""

        @JavascriptInterface
        fun getFcmStatus(): String = getSharedPreferences("tiger_native", MODE_PRIVATE)
            .getString("fcm_status", "Firebase token has not been requested yet") ?: "Firebase status unavailable"

        @JavascriptInterface
        fun refreshFcmToken() {
            runOnUiThread {
                getSharedPreferences("tiger_native", MODE_PRIVATE).edit().remove("fcm_token").apply()
                warmFirebaseToken()
            }
        }

        @JavascriptInterface
        fun getAppVersion(): String = try { packageManager.getPackageInfo(packageName, 0).versionName ?: "0.0.0" } catch (_: Exception) { "0.0.0" }

        @JavascriptInterface
        fun areNotificationsEnabled(): Boolean = NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled()

        @JavascriptInterface
        fun openNotificationSettings() {
            runOnUiThread {
                val settingsIntent = Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
                startActivity(settingsIntent)
            }
        }

        @JavascriptInterface
        fun isChatOverlayEnabled(): Boolean =
            getSharedPreferences("tiger_overlay", MODE_PRIVATE).getBoolean("enabled", false)

        @JavascriptInterface
        fun setChatOverlayEnabled(enabled: Boolean) {
            runOnUiThread {
                val prefs = getSharedPreferences("tiger_overlay", MODE_PRIVATE)
                prefs.edit().putBoolean("enabled", enabled).apply()
                if (!enabled) {
                    stopService(Intent(this@MainActivity, TigerChatOverlayService::class.java))
                    return@runOnUiThread
                }
                if (!Settings.canDrawOverlays(this@MainActivity)) {
                    val permissionIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                    startActivity(permissionIntent)
                }
            }
        }

        @JavascriptInterface
        fun dismissChatNotification() {
            runOnUiThread {
                stopService(Intent(this@MainActivity, TigerChatOverlayService::class.java))
            }
        }

        @JavascriptInterface
        fun showChatNotification(title: String, body: String, path: String, avatarUrl: String) {
            if (!getSharedPreferences("tiger_overlay", MODE_PRIVATE).getBoolean("enabled", false)) return
            if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this@MainActivity)) return
            val intent = Intent(this@MainActivity, TigerChatOverlayService::class.java)
                .setAction(TigerChatOverlayService.ACTION_SHOW_NOTIFICATION)
                .putExtra(TigerChatOverlayService.EXTRA_TITLE, title)
                .putExtra(TigerChatOverlayService.EXTRA_BODY, body)
                .putExtra(TigerChatOverlayService.EXTRA_PATH, path)
                .putExtra(TigerChatOverlayService.EXTRA_AVATAR, avatarUrl)
            ContextCompat.startForegroundService(this@MainActivity, intent)
        }
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    companion object {
        const val EXTRA_QUICK_REPLY = "tiger_quick_reply"
        private const val MEDIA_PERMISSION_REQUEST_CODE = 7302
    }
}
