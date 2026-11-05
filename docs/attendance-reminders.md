# Missing time-out reminders

Administrators configure **Sites & settings → Missing time-out reminders**. Each site's optional `shiftEnd` is stored in the existing Supabase workspace JSON, using `HH:mm` Philippine Time (UTC+8). A blank saved time disables that site's reminders. Existing sites remain disabled until configured. No Supabase table or RLS changes are needed.

A check-in before the cutoff becomes overdue at that day's cutoff. A check-in at or after the cutoff becomes overdue at the following day's cutoff, supporting evening starts. The reminder means an open record needs review; it is not proof that the worker left, and it never creates a time-out automatically.

In-app notifications name the worker and link to their attendance date. Auditors see only assigned sites; administrators can review all sites. The alert disappears when the attendance record has a time-out. Existing correction requests and administrator approval remain available when the actual departure time needs correcting.

The private `hewers-attendance-reminders` Cloudflare Worker runs every five minutes and invokes the main backend through a service binding. Both Workers require the shared server-only `REMINDER_CRON_SECRET`; the internal endpoint is excluded from the Vercel public API gateway. `drizzle/0008_attendance_reminders.sql` provides per-event/user/device delivery claims to prevent repeated and concurrent sends. Failed attempts can retry at five-minute intervals, up to six attempts. The delivery ID is based on the attendance record, not on polling time. Changing a shift cutoff does not resend an already delivered reminder for the same attendance record.

Apply `drizzle/0009_reminder_device_support.sql` as well; token registration records whether the installed APK supports this reminder type, so older APKs are excluded from reminder delivery.

Phone delivery requires Android app **0.3.0 or newer**, Google Play services, notification permission, and an active signed-in session. It respects account deactivation, expired sessions, current auditor role and site assignments. The lock-screen message contains no worker name or attendance detail; opening Hewers retrieves the current permitted records. Existing APK versions still get in-app alerts, but cannot recognize the new background reminder message type. Physical-phone background delivery must be verified separately from mock tests and CI compilation.

Deploy order: apply the D1 migration, deploy the main backend, configure `REMINDER_CRON_SECRET` on both Workers, and deploy the scheduler using `wrangler.reminders.jsonc`. Publish the frontend and Android APK from the same source commit. A secret-authenticated POST with `{"dryRun":true}` to the internal endpoint reports counts without sending notifications or claiming delivery records. Never put the secret in source, frontend variables, command arguments, or logs.
