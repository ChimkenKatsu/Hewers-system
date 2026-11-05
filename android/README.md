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
- The service needs an internet connection to load. Existing drafts remain local; the first offline app launch is not supported.
- Version 0.2.0 includes Firebase Messaging. Android 13+ asks for notification permission after signing in. If declined, enable Worker approvals in Android's app notification settings. Google Play services are required. Tapping an alert opens Notifications; decisions still require signing in and reviewing the current request.

## Push rollout (not yet enabled in production)

The supplied `app/google-services.json` matches project `hewers-system` and package `com.hewers.workforce`. It is Firebase's public Android client configuration, not a server sending credential. The app includes only Messaging, with no Analytics SDK added.

Credential setup completed on 2026-11-05 with the owner's approval: `hewers-push-sender@hewers-system.iam.gserviceaccount.com` has the Firebase Cloud Messaging API Admin role. Its locally generated public certificate is registered with Google; its private key was imported into the `hewers-workforce` Worker secret `FCM_SERVICE_ACCOUNT_JSON`, then removed from local temporary storage. Live OAuth and an FCM validate-only request passed, without sending any device message. The uploaded certificate expires on 2027-11-05; replace the key before then. Application deployment, D1 migration, updated APK compilation, and real-phone verification remain pending.

Before rollout:

1. Apply `drizzle/0007_android_push.sql` to the private D1 authentication database, using the production Wrangler configuration. Do this before publishing the updated backend and frontend. No Supabase schema change is required.
2. Enable Firebase Cloud Messaging API v1 in `hewers-system`. Create a dedicated service account with the Firebase Cloud Messaging API Admin role (`roles/firebase.messagingAdmin`), rather than a broad project administrator role. Credential creation and IAM changes require the owner's explicit approval.
3. Store that account's JSON as the Cloudflare Worker secret `FCM_SERVICE_ACCOUNT_JSON` (completed as recorded above). Import replacements through a secure prompt/file stream; never put the private key in command arguments, source control, browser client variables, Vercel frontend configuration, or the APK.
4. Publish backend and frontend together, build/test the updated APK, and install on a Google Play services phone. Production deployment remains pending.
5. With administrator and auditor test accounts, allow notifications, submit a worker request, background the admin app, verify an alert and tap-to-review, accept/decline, then background the auditor app and verify its decision alert. Also verify denied permission, account switching, logout, revoked account, and an expired session. Use test records with permission.

Registrations bind to the current named-account session. Signing out, session expiry (currently 12 hours), account deactivation, and password-change requirements stop server eligibility. Opening Hewers while signed in refreshes the token registration. A token is reassigned when the phone signs into another account. Auditors receive only their own decisions within their currently assigned sites; administrators receive new pending requests. No worker names, decline reasons, photos, or face templates appear in push payloads. The notification is a prompt to review, not an approval action.

Delivery is best effort with a bounded 10-second send attempt after a successful workspace commit. Firebase failures cannot roll back a saved request, and are logged without tokens or credentials. There is no durable retry queue in this version; the in-app history remains the source for missed alerts. Android force-stop, permission settings, network conditions, and battery restrictions can prevent delivery. An unregistered Firebase token is removed on a permanent UNREGISTERED response. Stale registrations are excluded after 30 days.

Local verification: `tests/push-api.mjs` uses disposable D1 and mock Firebase with an ephemeral RSA key; it does not send to real phones. Run after bundling `tests/api-worker.ts` as described by the API tests. Native compilation and a real-device notification test remain required before claiming this feature works in a distributed APK.

## Before client distribution

Install on a real Android phone and verify sign-in, first-password change, camera permission denial/retry, a consenting worker's enrollment/match, photo draft restore/upload, notifications, CSV export, app background/resume, and the Android Back button. CI compilation and policy tests do not establish real-camera accuracy. Configure stable release signing and a Play Console listing separately when ready.
