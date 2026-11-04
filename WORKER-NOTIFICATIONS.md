# Worker approvals, notification history, and local drafts

- Admin worker-request popups and auditor decision popups follow the existing live workspace updates (about two seconds in an open, visible tab).
- Declining a worker requires a reason, validated by the backend and shown to the submitting auditor.
- Notification history is derived from existing worker requests. Read IDs are stored per authenticated account in the existing D1 `auth_user.notification_reads` field. No additional Supabase tables are needed. Reads merge atomically across devices and are checked against the account's allowed notifications.
- Worker and site-photo drafts save in IndexedDB under the current workspace and account. They include the selected photo file. Closing the form preserves the draft; reopening restores it. Successful submission clears it. Discard draft removes the local draft.
- Drafts remain on that browser/device and hostname. They do not upload automatically, and this does not make the entire app available for a first-time offline launch. Reconnect and submit deliberately; attendance is never queued offline.

Deployment: apply `drizzle/0006_notification_reads.sql` once to the existing login database before deploying the API. The separate Supabase legacy-table retirement migration remains unapplied.
