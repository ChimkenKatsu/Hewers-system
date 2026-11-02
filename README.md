# SiteLedger — Phase 1 development release

Responsive construction operations application using React, TypeScript, Vinext, D1 and R2. Hosted as a private Sites application.

## Working modules
- Construction sites, worker registration, manual attendance, inventory movements, low-stock indicators, photo evidence, CSV reports.
- Shared workspace memberships: manager, site supervisor, inventory custodian, viewer. The owner is administrator.
- Server-enforced roles and site scope on reads, writes, face routes and photo access. Revocation takes effect on the next request.
- Face enrollment, replacement/removal and one-to-one face-assisted time-in/time-out pilot.
- Sample workspace with role previews. Sample changes are in memory only. Camera enrollment is disabled in sample mode.

## Face pilot
Open the real workspace, create a site and test worker, open Attendance > Face recognition. Select Enroll / replace, confirm the worker's permission, start the camera, then capture. Select time-in or time-out to compare two fresh captures with the stored template. A mismatch never records attendance. Remove enrollment using its explicit confirmation control.

Models and library are served from this application, not an external recognition API. Camera frames stay in the browser. Numerical 128-dimensional descriptors are sent to the protected server for enrollment/matching. Templates are stored in D1, are not returned by API, and are retained until removed. This does not include automated retention or backup deletion workflows.

Pinned model: @vladmandic/face-api 1.7.15, SSD MobileNet + 68 landmarks + ResNet face descriptors. MIT license preserved in public/vendor. Upstream repository is archived; this is a feasibility pilot, not a commitment to this library for production. No age, gender, emotion or other attribute inference is enabled.

The server checks two finite, correctly-sized descriptors, capture consistency, one-to-one distance threshold 0.5, a single-use 90-second capture challenge, role/site permissions and attempt limits. The threshold has not been calibrated on client workers/devices. Capture tokens prevent request token reuse, not biometric spoofing.

**Not verified liveness or secure biometric attendance.** A malicious authorized client can fabricate/replay descriptor values; photos/screens may match. Supervised testing only. All matched records are labeled Face-assisted pilot, not biometric verified. A production anti-fraud rollout requires trusted capture/validated presentation-attack detection, worker/device evaluation, enrollment controls and retention decisions.

## Staff access
1. Owner opens Staff & permissions and enters the staff member's ChatGPT sign-in email, role and assigned sites.
2. The person also needs permission to visit the private Site through Sites sharing. This app does not invite users or widen Site access automatically.
3. After signing in, staff select Team workspace from the workspace dropdown.

Role matrix:
- Administrator (owner): all sites and operations, staff administration.
- Manager: read assigned sites.
- Supervisor: workers, attendance, face enrollment and photos for assigned sites; view materials.
- Custodian: materials and photos for assigned sites; no worker/attendance access.
- Viewer: read assigned sites; no mutations.

A staff member may also have an unrelated personal workspace. They cannot use its administrator status to access the owner's workspace.

## Verification
- `npx tsc --noEmit`
- `node --experimental-strip-types tests/operations.test.ts`
- `node --experimental-strip-types tests/security.test.ts`
- `node_modules/.bin/esbuild tests/api-worker.ts --bundle --format=esm --platform=browser --external:cloudflare:workers --outfile=.sites-runtime/api-test-worker.mjs`
- `node tests/api-security.mjs`

The integration suite runs the real route handlers in isolated Miniflare D1/R2. It tests role/site authorization, revoked and anonymous callers, CSRF, membership binding, face challenge reuse, synthetic matching/non-matching descriptors, attendance transitions, and protected photo upload/access. No real face images or biometric templates are included in test fixtures. Actual browser models have loaded successfully; a consenting person's live camera match remains a device test.

## Development
Use the Sites installation/build helpers. DB binding is DB; R2 binding is BUCKET. Schema is db/schema.ts; append migrations rather than altering applied SQL. Production identity must come from Sites' protected gateway, never public client-supplied headers.

The initial workspace document is JSON in D1 with optimistic revision checks. Before broad multi-user rollout, normalize records, paginate queries, add operational monitoring, backups and retention controls. Memberships, templates and capture challenges are separate tables. Unreferenced uploads and expired challenges need lifecycle cleanup for production.

Still outside this release: Google Sheets/Drive sync, native apps, BOQ validation, payroll, full progress reporting, automated invitation emails, validated liveness/anti-spoofing and formal production acceptance.
