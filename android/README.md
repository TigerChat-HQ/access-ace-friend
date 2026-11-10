# TIGERCHATS Android wrapper

This is an isolated Android application shell around the existing hosted TIGERCHATS web app. It uses the same Render URL and the existing Supabase-backed sign-in, profiles, conversations and messages. It does not replace or change the Render web deployment.

## Firebase setup required before a real Android build

1. In Firebase Console, open project **tigerchat-39e19**.
2. Add an **Android app** with package name `com.tigerchats.app`.
3. Download that Android app's `google-services.json` and place it at `android/app/google-services.json`. Do not commit this file.
4. Ensure Firebase Cloud Messaging is enabled for the project.
5. Build/install the Android app, sign in using the existing TIGERCHATS account, and allow notifications.

The app module applies the Google Services Gradle plugin only when `google-services.json` is present. Without it, the web wrapper can still be built for local UI inspection, but native FCM will not initialize.

## Build

Open the `android/` directory in Android Studio (JDK 17, Android SDK 35), allow Gradle sync, then build the `app` run configuration. The first build needs network access to resolve Gradle dependencies.

## Bubble behavior

- Android FCM data messages with `kind=message` and a conversation path create a conversation shortcut and a bubble-capable notification.
- Android 11+ is required for system bubbles. The user must also enable bubbles for TIGERCHATS in Android notification settings; Android may choose to show a normal notification instead.
- Calls and other notification kinds remain regular notifications.
- The bubble opens the hosted TIGERCHATS chat route, so the same account and backend are used.

## Current integration boundary

The existing `device_push_tokens` table and `dispatch-push` Edge Function already use Firebase Cloud Messaging data messages. The web client currently registers browser FCM tokens. This wrapper exposes its native FCM token to the web runtime as `window.TigerNative.getFcmToken()`; the web client must register that token for the signed-in user. The native Firebase Android app registration and end-to-end device test are still required before release.

## Safety

- Never commit `google-services.json`, signing keystores, service-account credentials or release passwords.
- Keep the Render web app as the production web target; Android changes are isolated under this directory.
