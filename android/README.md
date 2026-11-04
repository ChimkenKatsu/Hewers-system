# Hewers Android test app

This Android APK runs the existing HTTPS Hewers interface in an Android app container. Accounts, site permissions, approvals, inventory, and photos use the same Vercel/Cloudflare service. It is the first installable Android build; it is not a complete rewrite of the screens into native Android views.

## Build and install

The `Build Hewers Android APK` GitHub Actions workflow builds on changes under `android/` or can be started manually. It uses the hosted runner's existing Android SDK, JDK 17, Gradle 8.13, and Android Gradle Plugin 8.13.2. Download the `Hewers-Android-test` artifact, unzip it, and install `Hewers-Android-test.apk` on an Android 8.0 or newer test phone. Android may ask you to authorize installation from the app opening the APK. The APK is signed with a debug key for testing and is not a Play Store release. Future test builds may require uninstalling an earlier debug build because the hosted runner generates a new debug signing key; uninstalling removes device-local drafts and login state. A stable private signing key is needed before distributing updates to the client.

For local development, open this directory in Android Studio with the Android 36 SDK installed, or run Gradle 8.13 with JDK 17: `gradle :app:testDebugUnitTest :app:lintDebug :app:assembleDebug`.

## Device behavior

- Camera permission is requested only when the trusted Hewers page asks to capture video. Microphone and location are not granted.
- Photo uploads use the Android document picker; the app has no broad storage permission.
- CSV reports and credential text files use an origin-restricted WebMessage listener and Android's Save dialog. No native JavaScript interface is exposed to arbitrary web pages.
- External HTTPS links, including Google connection setup, open in the phone's browser. Browser and app login sessions are separate.
- Cleartext HTTP and mixed content are blocked. Certificate errors are cancelled. Only `https://hewers-system.vercel.app` is kept inside the main WebView.
- Cookies and IndexedDB drafts stay in the app's private storage. Android backup is disabled. No passwords, face templates, or server keys are embedded in the APK.
- The service needs an internet connection to load. Existing drafts remain local; the first offline app launch is not supported. Notifications update while Hewers is open; this build has no background device push notifications.

## Before client distribution

Install on a real Android phone and verify sign-in, first-password change, camera permission denial/retry, a consenting worker's enrollment/match, photo draft restore/upload, notifications, CSV export, app background/resume, and the Android Back button. CI compilation and policy tests do not establish real-camera accuracy. Configure stable release signing and a Play Console listing separately when ready.
