# Hewers for iPhone and iPad

An iOS 16+ UIKit/WKWebView app shell for the existing HTTPS Hewers workspace. It uses the same hosted interface, named accounts and operational database. No private backend key or password is bundled.

## Build on a Mac

Install Xcode and XcodeGen (`brew install xcodegen`), then run from the repository root:

```sh
xcodegen generate --spec ios/project.yml --project ios
open ios/Hewers.xcodeproj
```

Choose the Hewers scheme and an iPhone simulator. The GitHub Actions workflow **Build Hewers iPhone preview** also generates the project, builds it and runs policy/unit and isolated UI tests on a Mac runner. Its ZIP contains a simulator `.app`, not an installable iPhone `.ipa`.

## Supported shell behavior

- Only the exact HTTPS Hewers origin remains in the embedded browser. User-activated external HTTPS links open in Safari. HTTP, file, JavaScript, user-info and lookalike-host navigation is blocked.
- Camera requests are prompted only for the trusted main frame and video capture. Audio and combined audio/video requests are denied. Face matching is the existing supervised camera workflow, not Apple Face ID, and has no liveness detection.
- Site evidence uploads use WebKit's system file picker. Camera and photo usage descriptions are included.
- The origin-checked text-export bridge provides the iOS share sheet for CSV and text exports up to 2 MB. Files are staged in a protected, backup-excluded temporary directory and removed after the share sheet finishes.
- The app has loading progress, retry after a failed connection, back navigation, persistent app-private website data and an Open in Safari control. Safari and app sign-in sessions are separate.
- Internet is required. In-app notifications use the existing website. **iOS background push is not configured**; the Android FCM registration bridge is not exposed on iOS.

## Distribution requires Apple setup

The owner has no Apple Developer Program account as of 6 November 2026. No certificate, provisioning profile, APNs key, team ID or App Store Connect application has been created. No TestFlight upload is claimed.

For TestFlight, enroll the company in the Apple Developer Program, select its team in Xcode and confirm the bundle ID `com.hewers.workforce` is available. Configure signing and create an App Store Connect app. Archive a Release build, validate, upload, and complete Apple's beta review requirements. The app's metadata, privacy disclosures, permissions and suitability for App Store distribution need review before submission. Do not commit signing keys or provisioning profiles.

Before real-device acceptance, test camera permission allowed/denied, enrollment with consent, successful and mismatched face attendance, camera interruption/backgrounding, worker queue behavior, file/photo selection, report Save to Files, login persistence, logout, offline retry, portrait/landscape and iPad layouts. CI fixtures do not establish face accuracy or real-person camera performance.

Apple references: [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview), [media permission delegate](https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:requestmediacapturepermissionfor:initiatedbyframe:type:decisionhandler:)), [membership and distribution](https://developer.apple.com/help/account/membership/programs-overview/), [TestFlight](https://developer.apple.com/testflight/).
