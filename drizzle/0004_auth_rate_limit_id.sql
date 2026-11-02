ALTER TABLE auth_rate_limit ADD COLUMN id TEXT;
CREATE UNIQUE INDEX auth_rate_limit_id ON auth_rate_limit(id);
