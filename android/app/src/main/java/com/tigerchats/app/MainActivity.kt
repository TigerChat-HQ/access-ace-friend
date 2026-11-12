package com.tigerchats.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.ConsoleMessage
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
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
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

open class MainActivity : Activity() {
    protected lateinit var webView: WebView
    private val siteUrl = "https://tigerchat-hq.onrender.com"
    private var pendingPath = "/"
    private var pendingQuickReply: String? = null
    private var pendingNativeCallType: String? = null
    private var pageLoaded = false
    // Queue overlapping WebView media requests while Android's permission dialog is open.
    private val pendingMediaPermissionRequests = mutableListOf<PermissionRequest>()
    private var mediaPermissionDialogOpen = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installNativeCrashCapture()
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
            override fun onReceivedError(view: WebView, request: android.webkit.WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (error.errorCode == android.webkit.WebViewClient.ERROR_ABORTED) return
                val url = request.url
                recordNativeDiagnostic(
                    source = "android_webview",
                    category = if (request.isForMainFrame) "webview_page_load" else "webview_resource_load",
                    title = if (request.isForMainFrame) "TigerChat page failed to load" else "Website resource failed to load",
                    message = "WebView error ${error.errorCode}: ${error.description}",
                    severity = if (request.isForMainFrame) "critical" else "medium",
                    metadata = JSONObject().put("errorCode", error.errorCode).put("failingUrl", safeDiagnosticUrl(url)).put("mainFrame", request.isForMainFrame)
                )
            }

            override fun onReceivedHttpError(view: WebView, request: android.webkit.WebResourceRequest, response: android.webkit.WebResourceResponse) {
                super.onReceivedHttpError(view, request, response)
                if (response.statusCode < 400) return
                recordNativeDiagnostic(
                    source = "android_webview",
                    category = if (request.isForMainFrame) "webview_http" else "webview_resource_http",
                    title = "Website returned HTTP ${response.statusCode}",
                    message = "WebView request failed with HTTP ${response.statusCode} ${response.reasonPhrase}",
                    severity = if (response.statusCode >= 500) "critical" else "high",
                    metadata = JSONObject().put("statusCode", response.statusCode).put("url", safeDiagnosticUrl(request.url)).put("mainFrame", request.isForMainFrame)
                )
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                recordNativeDiagnostic(
                    source = "android_webview", category = "webview_ssl", title = "Website SSL certificate error",
                    message = "Android WebView rejected the website certificate (primary error ${error.primaryError}).",
                    severity = "critical", metadata = JSONObject().put("primaryError", error.primaryError).put("url", safeDiagnosticUrl(error.url))
                )
                handler.cancel()
            }

            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                recordNativeDiagnostic(
                    source = "android_webview", category = "webview_renderer_crash", title = "TigerChat WebView renderer stopped",
                    message = "Android WebView renderer process exited unexpectedly.", severity = "critical",
                    metadata = JSONObject().put("didCrash", detail.didCrash()).put("priorityAtExit", detail.rendererPriorityAtExit())
                )
                runOnUiThread { if (!isFinishing) finish() }
                return true
            }

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
                deliverPendingNativeCall(view)
                view.evaluateJavascript("window.dispatchEvent(new CustomEvent('tiger:native-diagnostics-ready'))", null)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    recordNativeDiagnostic(
                        source = "android_webview", category = "webview_console", title = "Website JavaScript console error",
                        message = message.message().take(1200), severity = "high",
                        metadata = JSONObject().put("sourceId", safeDiagnosticUrl(message.sourceId())).put("lineNumber", message.lineNumber())
                    )
                }
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val origin = request.origin
                    val pageHost = Uri.parse(webView.url ?: "").host
                    if (
                        origin.scheme != "https" ||
                        origin.host != "tigerchat-hq.onrender.com" ||
                        pageHost != "tigerchat-hq.onrender.com"
                    ) {
                        android.util.Log.w(TAG, "Blocked WebView media permission for origin=" + origin + " page=" + webView.url)
                        try { request.deny() } catch (_: Exception) { }
                        return@runOnUiThread
                    }

                    // Only expose microphone/camera; never grant other WebView resources.
                    val mediaResources = request.resources.filter {
                        it == PermissionRequest.RESOURCE_AUDIO_CAPTURE ||
                            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                    }
                    val androidPermissions = buildList {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in mediaResources) add(Manifest.permission.RECORD_AUDIO)
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in mediaResources) add(Manifest.permission.CAMERA)
                    }.distinct().toTypedArray()
                    if (androidPermissions.isEmpty()) {
                        android.util.Log.w(TAG, "Denied WebView request with no supported media resources")
                        try { request.deny() } catch (_: Exception) { }
                        return@runOnUiThread
                    }

                    val missing = androidPermissions.filter {
                        ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED
                    }
                    android.util.Log.i(TAG, "WebView media request: resources=" + mediaResources + " missing=" + missing)
                    if (missing.isEmpty()) {
                        grantWebMediaPermission(request)
                    } else {
                        pendingMediaPermissionRequests.add(request)
                        if (!mediaPermissionDialogOpen) {
                            mediaPermissionDialogOpen = true
                            try {
                                ActivityCompat.requestPermissions(this@MainActivity, missing.toTypedArray(), MEDIA_PERMISSION_REQUEST_CODE)
                            } catch (error: Exception) {
                                android.util.Log.e(TAG, "Could not request Android media permissions", error)
                                pendingMediaPermissionRequests.forEach { pending -> try { pending.deny() } catch (_: Exception) { } }
                                pendingMediaPermissionRequests.clear()
                                mediaPermissionDialogOpen = false
                            }
                        }
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                pendingMediaPermissionRequests.remove(request)
            }
        }
        webView.addJavascriptInterface(NativeBridge(), "TigerNative")
        setContentView(webView)
        // Use Android's measured WebView height as the authoritative viewport while the IME resizes the Activity.
        webView.addOnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->
            (view as? WebView)?.let(::applyNativeViewportHeight)
        }
        pendingPath = safePath(intent?.getStringExtra("path"))
        pendingQuickReply = intent?.getStringExtra(EXTRA_QUICK_REPLY)
        pendingNativeCallType = intent?.getStringExtra(EXTRA_NATIVE_CALL_TYPE)?.takeIf { it == "voice" || it == "video" }
        webView.loadUrl(siteUrl + "/")
        warmFirebaseToken()
    }

    private fun grantWebMediaPermission(request: PermissionRequest) {
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
            if (allowed.isNotEmpty()) {
                android.util.Log.i(TAG, "Granted WebView media resources: " + allowed.joinToString())
                request.grant(allowed)
            } else {
                android.util.Log.w(TAG, "Denied WebView media request: Android permissions are not granted")
                request.deny()
            }
        } catch (error: Exception) {
            // The WebView may have navigated away while the Android permission dialog was open.
            android.util.Log.w(TAG, "WebView media permission request became stale", error)
        } finally {
            pendingMediaPermissionRequests.remove(request)
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
        mediaPermissionDialogOpen = false
        val requests = pendingMediaPermissionRequests.toList()
        pendingMediaPermissionRequests.clear()
        val retryPermissions = linkedSetOf<String>()
        var denied = false
        requests.forEach { request ->
            val required = buildList {
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in request.resources) add(Manifest.permission.RECORD_AUDIO)
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in request.resources) add(Manifest.permission.CAMERA)
            }
            val missing = required.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
            when {
                required.isEmpty() -> try { request.deny() } catch (_: Exception) { }
                missing.isEmpty() -> grantWebMediaPermission(request)
                missing.any { it !in permissions } -> {
                    pendingMediaPermissionRequests.add(request)
                    retryPermissions.addAll(missing.filter { it !in permissions })
                }
                else -> {
                    denied = true
                    try { request.deny() } catch (_: Exception) { }
                }
            }
        }
        if (retryPermissions.isNotEmpty()) {
            mediaPermissionDialogOpen = true
            try {
                ActivityCompat.requestPermissions(this, retryPermissions.toTypedArray(), MEDIA_PERMISSION_REQUEST_CODE)
            } catch (error: Exception) {
                android.util.Log.e(TAG, "Could not request remaining Android media permissions", error)
                pendingMediaPermissionRequests.forEach { pending -> try { pending.deny() } catch (_: Exception) { } }
                pendingMediaPermissionRequests.clear()
                mediaPermissionDialogOpen = false
                denied = true
            }
        }
        if (denied) showMediaPermissionSettingsPrompt()
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
    private fun deliverPendingNativeCall(view: WebView) {
        val callType = pendingNativeCallType ?: return
        val conversationId = Regex("[?&]c=([0-9a-fA-F-]{36})")
            .find(pendingPath)?.groupValues?.getOrNull(1) ?: return
        val payload = org.json.JSONObject()
            .put("callType", callType)
            .put("conversationId", conversationId)
        view.evaluateJavascript(
            "window.__tigerPendingNativeCall = $payload; window.dispatchEvent(new CustomEvent('tiger:native-start-call',{detail:$payload}));",
            null,
        )
        pendingNativeCallType = null
        intent?.removeExtra(EXTRA_NATIVE_CALL_TYPE)
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
        pendingNativeCallType = intent.getStringExtra(EXTRA_NATIVE_CALL_TYPE)
            ?.takeIf { it == "voice" || it == "video" }
        if (!::webView.isInitialized) return
        if (pageLoaded) {
            applyPendingPath(webView)
            deliverPendingQuickReply(webView)
            deliverPendingNativeCall(webView)
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
    }

    override fun onDestroy() {
        pendingMediaPermissionRequests.forEach { request -> try { request.deny() } catch (_: Exception) { } }
        pendingMediaPermissionRequests.clear()
        mediaPermissionDialogOpen = false
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun safeDiagnosticUrl(raw: String): String = try {
        val uri = Uri.parse(raw)
        (uri.host ?: "unknown") + (uri.path ?: "/")
    } catch (_: Exception) { "unknown" }

    @Synchronized
    private fun recordNativeDiagnostic(
        source: String,
        category: String,
        title: String,
        message: String,
        severity: String,
        metadata: JSONObject = JSONObject(),
    ) {
        try {
            val prefs = getSharedPreferences(NATIVE_DIAGNOSTICS_PREFS, MODE_PRIVATE)
            val current = try { JSONArray(prefs.getString(NATIVE_DIAGNOSTICS_QUEUE, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
            val entry = JSONObject()
                .put("id", UUID.randomUUID().toString())
                .put("source", source)
                .put("category", category)
                .put("title", title.take(240))
                .put("message", message.replace(Regex("(?i)(token|password|authorization)(\\s*[:=]\\s*)[^&\\s,]+"), "$1$2[REDACTED]").take(1800))
                .put("severity", severity)
                .put("createdAt", System.currentTimeMillis())
                .put("metadata", metadata)
            val next = JSONArray()
            val start = (current.length() - 49).coerceAtLeast(0)
            for (index in start until current.length()) next.put(current.getJSONObject(index))
            next.put(entry)
            prefs.edit().putString(NATIVE_DIAGNOSTICS_QUEUE, next.toString()).apply()
            android.util.Log.w(TAG, "Diagnostic captured: $category / $title")
        } catch (error: Exception) {
            android.util.Log.e(TAG, "Could not persist native diagnostic", error)
        }
    }

    private fun installNativeCrashCapture() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            recordNativeDiagnostic(
                source = "android_native", category = "native_crash", title = "TigerChat Android app crashed",
                message = "${error.javaClass.simpleName}: ${error.message ?: "No crash message"}", severity = "critical",
                metadata = JSONObject().put("thread", thread.name).put("stack", error.stackTraceToString().take(5000)).put("appVersion", try { packageManager.getPackageInfo(packageName, 0).versionName } catch (_: Exception) { "unknown" })
            )
            if (previous != null) previous.uncaughtException(thread, error)
            else {
                android.os.Process.killProcess(android.os.Process.myPid())
                kotlin.system.exitProcess(10)
            }
        }
    }

    private fun publishTokenToWeb(token: String) {
        if (!::webView.isInitialized) return
        val encoded = org.json.JSONObject.quote(token)
        webView.post { webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('tiger:native-fcm-token',{detail:$encoded}))", null) }
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun getPendingDiagnostics(): String = getSharedPreferences(NATIVE_DIAGNOSTICS_PREFS, MODE_PRIVATE)
            .getString(NATIVE_DIAGNOSTICS_QUEUE, "[]") ?: "[]"

        @JavascriptInterface
        fun acknowledgeDiagnostic(id: String) {
            if (id.isBlank()) return
            synchronized(this@MainActivity) {
                val prefs = getSharedPreferences(NATIVE_DIAGNOSTICS_PREFS, MODE_PRIVATE)
                val current = try { JSONArray(prefs.getString(NATIVE_DIAGNOSTICS_QUEUE, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
                val remaining = JSONArray()
                for (index in 0 until current.length()) {
                    val item = current.optJSONObject(index) ?: continue
                    if (item.optString("id") != id) remaining.put(item)
                }
                prefs.edit().putString(NATIVE_DIAGNOSTICS_QUEUE, remaining.toString()).apply()
            }
        }

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
        fun openMessageBubbleSettings() {
            runOnUiThread {
                val settingsIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Intent(android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
                        .putExtra(android.provider.Settings.EXTRA_CHANNEL_ID, "messages")
                } else {
                    Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
                }
                startActivity(settingsIntent)
            }
        }

        @JavascriptInterface
        fun openNotificationSettings() {
            runOnUiThread {
                val settingsIntent = Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
                startActivity(settingsIntent)
            }
        }

    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    companion object {
        const val EXTRA_QUICK_REPLY = "tiger_quick_reply"
        const val EXTRA_NATIVE_CALL_TYPE = "tiger_native_call_type"
        private const val MEDIA_PERMISSION_REQUEST_CODE = 7302
        private const val TAG = "TigerChatMedia"
        private const val NATIVE_DIAGNOSTICS_PREFS = "tiger_native_diagnostics"
        private const val NATIVE_DIAGNOSTICS_QUEUE = "pending_diagnostics"
    }
}
