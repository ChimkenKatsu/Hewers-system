CREATE TABLE IF NOT EXISTS google_connections (
 owner TEXT PRIMARY KEY NOT NULL,
 token TEXT NOT NULL,
 folder_id TEXT,
 sheet_id TEXT,
 last_sync TEXT,
 lease INTEGER NOT NULL DEFAULT 0
);
