# Team accounts and worker approvals

The application supports four named admin logins (`admin1` through `admin4`)
and one site-scoped `auditor1` login. Administrators have access to all sites,
account management and worker approvals. The auditor can submit workers,
use face attendance for approved workers, record stock changes, and upload photos
only at assigned sites. Pending workers do not enter the worker directory until
an administrator accepts the request. Declines and approvals retain reviewer and
time in the audit history. In-app notifications refresh every 15 seconds while
the workspace is open. No emails or push messages are sent.

## Setup and deployment

- Set `AUTH_SECRET` (random secret, at least 32 characters) and `AUTH_BASE_URL`
  (the exact app origin) as server secrets. Local values are in `.dev.vars`.
- Apply all numbered SQL migrations, including `0003_team_accounts.sql` and
  `0004_auth_rate_limit_id.sql`, to the private D1 database. Existing site records
  are preserved. Account/session tables stay in D1 even when record storage uses
  the existing Supabase integration. Back up this private database accordingly.
- Open Staff access as the current setup owner. Select the auditor's sites and
  create the five accounts. Download their temporary passwords privately.
- Each person opens `/login`, enters their username and temporary password, and
  sets a personal password of at least 12 characters before accessing records.
- Existing trusted owner setup access is blocked once that owner's team is
  provisioned. Use the named accounts afterward. Do not create accounts before
  saving the returned temporary passwords; they cannot be recovered as plaintext.
- On a private Sites-hosted deployment, the website's outer sharing gate still
  applies before the app's username/password login. Username login does not
  automatically invite users or make a private website public.
- Separate computers can use a published HTTPS deployment. The local URL only
  serves the machine running this dev server; this change does not publish it.

Better Auth handles password hashing, signed HttpOnly session cookies, CSRF
checks and persistent rate limits. Public signup and user-management auth routes
are disabled. Permissions and active status are read from the database on each
protected request; disabling a user or resetting their password revokes sessions.
No administrator can disable their own account; at least one named admin remains
active. Administrative resets generate another temporary password and require
its owner to choose a personal password again.

Email recovery is deferred until real recovery addresses are supplied. For now,
another administrator can use **Staff access → Reset password**.

## Supabase alignment

Apply `supabase/migrations/20261102163410_align_team_accounts_approvals.sql`
after the existing integration schema. It adds RLS-protected, server-only account
metadata, auditor site assignments, and worker approval records. Password hashes
and session tokens are never copied to these tables. Account management retries
metadata sync when Staff access opens, and reports a warning if it cannot sync.
The private D1 account record remains authoritative for every permission check.

Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` only as server secrets. Enabling
the integration migrates an authorized administrator's workspace, legacy staff,
face enrollments, and photos without overwriting an existing Supabase state.
Back up both databases before changing storage providers. Do not remove a working
Supabase configuration after users have written new records there: D1 is then an
older snapshot, not an automatic failover database.

The setup account may see a sign-in message immediately after provisioning; use
admin1's temporary credentials to enter the named-account workflow. This is
intentional and prevents the legacy local mock owner from bypassing role checks.

## Verification

`tests/accounts-api.mjs` exercises real Better Auth sessions against isolated D1:
provisioning, first-password change, blocked public signup, auditor scope, worker
submission, pending-worker face denial, admin approval, repeated-review denial,
and account revocation. Existing API/security/Google tests remain available.
