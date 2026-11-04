# Hewers client-demo readiness

## Assessment

The core administration and auditor workflows are suitable for a guided client preview based on the automated and browser checks below. This is not a production sign-off or a measurement of real-camera face-recognition accuracy.

The installed Android APK loads the current Hewers interface from the existing service. The mobile layout updates appear when the app reloads; a new APK is not required for these screen changes.

## Verified

| Area | Evidence | Result |
| --- | --- | --- |
| Domain logic and UI support | All 12 existing TypeScript test suites | Passed |
| Account sessions, temporary-password change/reset and revocation | Isolated authenticated account API suite | Passed |
| Admin/auditor roles and assigned-site restrictions | Account, API-security and hosted-security suites | Passed |
| Worker submission, accept/decline, required reasons and notification privacy | Account API and worker-notification suites | Passed |
| Inventory accounting, negative-stock prevention and reviewed adjustments | Operations, reviews and API suites | Passed |
| Photo ownership, file validation, assigned-site access and CSRF denial | Isolated API suite | Passed |
| Google OAuth validation, encrypted token handling and export formatting | Google API suite with mocked Google responses | Passed; live Google consent/export was not repeated in this audit |
| Face challenge binding, replay rejection, mismatches and capture-quality checks | API and synthetic face-client/quality/motion suites | Passed; synthetic evidence does not establish accuracy on people |
| Phone layouts | 360px and 412px iframe viewport checks, card lists and bottom-sheet controls | Passed; no page-wide horizontal overflow |
| Form navigation | Fixed Save/Cancel footer and browser/Android-style history Back handling | Passed in browser preview |
| Live hosted service | Root, login and brand asset return 200; workspace, notifications and face endpoints reject signed-out requests with JSON 401 | Passed |
| Initial Android APK | Successful build, 3 native policy tests, Android lint and verified downloaded SHA-256 | Passed; build run 41855114475 |
| Current Android emulator install/launch/rotation/Back test | GitHub Actions run 41863973045 | Pending: no hosted runner assigned at audit completion |

The four isolated API suites were `accounts-api.mjs`, `api-security.mjs`, `hosted-security.mjs` and `google-api.mjs`. Test fixtures and mocked Google services were used for mutating tests. Live authenticated client accounts and a live Google export were not exercised in this audit.

## Fixes made during the audit

- Mobile attendance, worker, inventory and account tables become labeled cards.
- Compact home header, direct Add worker shortcut, larger touch targets and phone site-summary cards.
- Save and Cancel stay visible while long form fields scroll.
- Navigation returns to the top of the next screen and records page history for Back navigation.
- Auditors without available materials receive a clear message to ask an admin, instead of opening an unusable material-creation form.
- Expired/forbidden live workspace sessions return to the sign-in gate.
- Current on-site counts include open check-ins from previous dates; daily attendance remains filtered by the chosen date.
- Settings accurately identifies the available Android test app.

## Connectivity and notifications

Both Wi-Fi and mobile data work. Admin and auditor can be on different networks. A submitted worker request must reach the backend first; a visible, online admin app or browser checks for changes about every two seconds, plus network/processing time. Auditors receive approval/decline decisions through the same mechanism.

The current APK has no background device push. A closed or backgrounded app will not deliver these in-app popups until it returns to the foreground. Worker and photo drafts stay on that browser/app and device and are submitted deliberately after reconnecting. The app still needs internet to load its service.

## Before presenting face recognition or calling the system production-ready

1. Test a consenting enrolled person and a different person on the actual Android phone, in the site's lighting. Record success/failure and capture time across several people. Current matching is a supervised pilot without liveness detection.
2. Complete the Android emulator run and inspect its login, rotation and Back screenshots; also check camera permission, photo picking and export saving on a real phone.
3. Sign in to the actual client accounts and verify the expected site assignments and a live Google Sheets/Drive sync if those integrations will be demonstrated.
4. Collect the deferred recovery emails before enabling email recovery. Admin-issued temporary resets work now.
5. Configure a stable private release signing key before distributing APK updates to the client. The existing APK is a debug-signed test build, not a Play Store release; independently built debug APKs can have different signing keys.

The separate Supabase legacy-table retirement migration remains unapplied. The notification feature uses the existing account table's read-history field and adds no Supabase tables.

## Test links

- Initial successful Android build: https://github.com/ChimkenKatsu/Hewers-system/actions/runs/41855114475
- Android emulator run awaiting a runner: https://github.com/ChimkenKatsu/Hewers-system/actions/runs/41863973045
- Published app: https://hewers-system.vercel.app/
