-- Private account/session-scoped FCM registrations. Never expose via workspace payloads.
CREATE TABLE IF NOT EXISTS push_device (
 token TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES auth_session(id) ON DELETE CASCADE,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_device_user ON push_device(user_id);
