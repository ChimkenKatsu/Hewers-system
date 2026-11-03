# Phase 1 pilot before the mobile app

Use the intended phones, browsers and site lighting. Measure cold model load,
camera checks, and the server response separately; record median and slowest
scan times. Do not claim an accuracy percentage from the automated fixtures.

- Enrolled people must match their own selection. Test multiple sessions and
  lighting conditions. Review failures and retake poor enrollments with consent.
- Test other people against each enrollment. A wrong person must not record
  attendance. Escalate any false acceptance before using attendance for payroll.
- Try a static printed photo, a phone photo and a recorded video under supervision.
  The randomized camera motion check is not certified presentation-attack
  detection. Browser-generated landmarks and descriptors can be fabricated by
  a modified client. A trusted PAD provider needs separate integration and testing.
- Check four independent admin logins, auditor site restrictions, worker approval
  and decline, stock changes, low-stock notifications, and private photo access.
- Verify Google Sheets exports and Drive photos in the selected account. Retry
  sync and confirm no duplicate photo uploads. Face templates must not be exported.
- Record connectivity failures and whether offline capture is needed. Decide on
  offline queues, conflict resolution, camera support and push notifications before
  building Phase 2. Avoid storing face templates in an offline mobile cache.

## Current scan implementation

The scan screen preloads models, reuses its capture canvas, and caps camera input
at the requested 640-pixel working size. It detects all faces and evaluates
landmarks before running recognition on accepted motion frames. Recognition uses
the same Dlib-aligned crop as the library's original descriptor pipeline. Matching
thresholds, two consistent frontal samples, cross-enrollment ambiguity rejection,
single-use challenges and site authorization remain enforced on the server.

`tests/face-client.test.ts` verifies processing is skipped for rejected polling
frames. It is a mocked scheduling test, not a real-device latency benchmark.
`tests/face-motion.test.ts` and the API security suite check rejection paths;
neither establishes real-world spoof resistance.

## HTTPS hosting

Build with `npm run build`, then deploy with:

```text
npx wrangler deploy --config wrangler.production.jsonc
```

Existing secrets remain on the Worker. On a new environment, configure server-only
`AUTH_SECRET`, `AUTH_BASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and the four
Google settings in `GOOGLE-SETUP.md`. Never put values in the tracked config.
`AUTH_BASE_URL` must match the HTTPS origin; Google needs that origin's exact
`/api/google/callback` URI registered. The direct public host must keep
`TRUST_SITES_IDENTITY=false` so fabricated gateway headers cannot create access.

The production D1 database holds named-account credentials and encrypted Google
tokens; Supabase holds business records and private photos. Existing password
hashes were copied during initial deployment, without browser sessions. Use the
published app for future account management: local and production authentication
databases do not continuously replicate. Subsequent deployments must not reimport
an old account snapshot. Email recovery is deferred at the user's request until
the client supplies recovery addresses.
