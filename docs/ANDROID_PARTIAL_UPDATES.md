# TIGERCHATS incremental Android app updates

## What this update path does

The Android wrapper loads the hosted TIGERCHATS web application. Changes delivered in the web layer (React UI, styles, routes, and other web assets) can therefore be updated without replacing the Android APK.

Production builds now generate a content-derived service-worker revision and a revision-specific precache manifest. When a new service worker installs, it fetches the current HTML shell, reuses cached responses for unchanged content-hashed Vite assets, downloads only newly introduced or changed hashed bundles, then activates the new cache and removes the previous app cache.

Vite content-hashed filenames are essential: unchanged files keep the same URL and can be reused safely; changed files receive a new URL and are fetched once. The service worker remains offline-first for cached assets.

## What still needs a full APK

This is not binary APK patching. Changes to Kotlin/Java code, Android permissions, manifest entries, native SDKs, or other packaged Android resources still require a newly signed APK and normal Android package installation. A direct APK link always downloads the complete APK.

For a smaller native-install download, distribute an Android App Bundle through Google Play; Play can deliver device-specific split APKs. Do not attempt to overwrite an installed APK by applying an arbitrary binary diff.

## Rollout and verification

- Deploy the web build to the same origin used by the Android WebView (https://tigerchat-hq.onrender.com).
- Confirm the deployed sw.js changes and references its matching revision-specific precache manifest.
- On a device that already has the app installed, launch while online, wait for the worker to install, then reload/reopen once.
- Confirm unchanged hashed assets are copied from the previous cache and changed hashed assets are fetched.
- Verify the app still opens offline using the newly activated cache.
- Native changes must continue through the signed Android release workflow.

The first installation of this mechanism may need to download the current asset set once. Subsequent web releases can reuse unchanged cached bundles.
