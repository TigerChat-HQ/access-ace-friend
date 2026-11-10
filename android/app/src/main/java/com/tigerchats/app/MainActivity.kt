package com.tigerchats.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

open class MainActivity : Activity() {
    protected lateinit var webView: WebView
    private val siteUrl = "https://tigerchat-hq.onrender.com"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(NativeBridge(), "TigerNative")
        setContentView(webView)
        webView.loadUrl(targetUrl(intent?.getStringExtra("path")))
        warmFirebaseToken()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webView.loadUrl(targetUrl(intent.getStringExtra("path")))
    }

    private fun targetUrl(path: String?): String {
        val safePath = path?.takeIf { it.startsWith("/") && !it.startsWith("//") } ?: "/"
        return siteUrl + safePath
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
            FirebaseMessaging.getInstance(app).token
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
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
