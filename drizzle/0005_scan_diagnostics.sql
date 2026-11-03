CREATE TABLE scan_diagnostics (
 owner TEXT NOT NULL,id TEXT NOT NULL,operator_id TEXT NOT NULL,actor TEXT NOT NULL,
 worker_id TEXT NOT NULL,site_id TEXT NOT NULL,purpose TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('matched','rejected','error')),
 reason TEXT NOT NULL,source TEXT NOT NULL CHECK(source IN ('server','device')),
 duration_ms INTEGER,capture_ms INTEGER,server_ms INTEGER,model_ms INTEGER,
 device TEXT NOT NULL DEFAULT 'Unknown',browser TEXT NOT NULL DEFAULT 'Other',connection_type TEXT NOT NULL DEFAULT 'Unknown',
 created TEXT NOT NULL,PRIMARY KEY(owner,id)
);
CREATE INDEX scan_diagnostics_owner_time ON scan_diagnostics(owner,created DESC);
CREATE INDEX scan_diagnostics_operator_time ON scan_diagnostics(owner,operator_id,created DESC);
