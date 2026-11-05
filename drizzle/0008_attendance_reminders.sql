CREATE TABLE IF NOT EXISTS attendance_reminder_delivery (
 event_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 device_token TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 claimed_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 1,
 sent_at INTEGER,
 PRIMARY KEY(event_id,user_id,device_token)
);
