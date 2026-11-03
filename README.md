# Hewers — site operations

React/TypeScript/Vinext application published on Cloudflare Workers. Workspace records, approval history, face enrollments and photos use Supabase. Named-account passwords and sessions remain in private D1. Google sync exports attendance and inventory to Sheets and copies site photos to Drive; face templates are excluded.

## Six operations improvements

1. **Live face guidance:** Attendance → Scan attendance. The camera checks single-face visibility, size, pose, lighting and blur before enabling capture. Guidance and recognition share a serialized capture queue so frames cannot overwrite an active recognition task. Matching thresholds remain strict.
2. **Scan diagnostics:** Attendance → Scan diagnostics. Admins see workspace reports; auditors see their own reports for assigned sites. Reports contain safe failure categories, durations, coarse device/browser/connection information and a server/device source label. They contain no images or descriptors. The view shows the latest 200 reports within seven days; timings are device-reported and do not measure identity accuracy.
3. **Duplicate protection:** The face screen shows current checked-in status and selects the appropriate next action. The server rejects an invalid attendance transition before issuing a scan challenge. Existing revision checks prevent concurrent writes from recording two entries.
4. **Attendance corrections:** Attendance → Correction requests. Select an existing record, propose PHT times and give a reason. Only an admin decision changes attendance. Original/requested times, requester, decision, reviewer and reason remain in history. Overlaps, future times and stale records are rejected. An admin cannot accept their own request.
5. **Physical stock counts:** Materials inventory → Physical counts. Compare the physical quantity with the captured system balance and explain the count. Admin acceptance creates a signed Adjustment movement and updates stock. A changed balance requires a new count. Zero differences are recorded without creating a zero-quantity movement.
6. **Daily site summary:** Home shows attendance, current workers on site, dated stock updates/photos, current low stock and pending approvals. The selected site/date applies; current-position columns are explicitly labelled.

Pending correction and stock-count requests also appear in Notifications. Auditors can submit only for assigned sites and see their own review history. Four admin accounts and one assigned-site auditor account use independent username/password sign-in. See [TEAM-ACCESS.md](TEAM-ACCESS.md).

## Worker queue flow

Enroll each worker once before the shift. For daily attendance choose Time in/out, enable Keep camera on between workers, and use the worker search. After a successful record, Next worker clears the selection while preserving the camera stream. Capture prompts appear above the camera; a capture can be cancelled before the save request starts. Operators should wait for confirmation before moving to the next worker.

The client reuses the first/last forward-facing motion descriptors for the matching pair, reducing recognition calls from eight to six without changing pair, identity, ambiguity or motion thresholds. Readiness includes the same eye-open/centered gates as capture. Recoverable quality problems are shown in the current prompt; inference errors fail immediately. Limits are six challenges per worker/operator/minute and thirty total per operator/minute. Synthetic tests validate flow, not real-device throughput.

## Face recognition limits

The locally served face-api 1.7.15 engine uses SSD detection, 68 landmarks and 128-dimensional descriptors. Camera images remain on the device; numerical templates go to the protected matching API. Server checks include permissions, strict matching/ambiguity thresholds, consistent captures, rate limits, a single-use challenge and randomized eye/head movements. This browser motion check is not certified presentation-attack detection. Synthetic tests verify the decision logic; accuracy, latency and spoof resistance still require supervised evaluation with enrolled people and the actual devices. No live-camera acceptance test has been completed.

## Validation

- `npx tsc --noEmit`
- `npm run build`
- Bundle `tests/api-worker.ts` with esbuild into `.sites-runtime/api-test-worker.mjs`, then run `node tests/api-security.mjs`, `node tests/accounts-api.mjs`, `node tests/google-api.mjs`, and `node tests/hosted-security.mjs`.
- Bundle/run `tests/reviews.test.ts` and `tests/face-client.test.ts` for corrections, counts, PHT summaries and serialized camera guidance.
- `supabase/verify-operation-reviews.sql` verifies projections, signed adjustments and denied public privileges inside a rolled-back fixture transaction.

Supabase migrations live in `supabase/migrations`; D1 migrations live in `drizzle`. Apply schema changes before deploying. Production uses `wrangler.production.jsonc`; privileged keys belong only in ignored local server configuration or Worker secrets. Production APIs reject client-supplied identity headers and require a valid named-account session.

Email recovery activation remains deferred until the client supplies real recovery addresses. Native mobile apps, certified anti-spoofing, payroll and formal production acceptance remain future work.

## API response recovery

The server reuses its Better Auth configuration to avoid rebuilding authentication endpoints for each API request. Session validity, account activity, roles and assigned sites still come from D1 on every request. Enrollment loading retries a transient GET failure once and offers Retry loading enrollments after a persistent failure. HTML/non-JSON service errors receive readable messages. Attendance writes are never automatically retried; operators must check the attendance log if confirmation is interrupted.
