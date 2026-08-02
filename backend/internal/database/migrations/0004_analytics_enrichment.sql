-- Mailgeko Phase 2 analytics enrichment (Postgres)

ALTER TABLE email_events ADD COLUMN IF NOT EXISTS device       VARCHAR(50)  NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS platform     VARCHAR(30)  NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS country      VARCHAR(60)  NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS country_code VARCHAR(2)   NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS city         VARCHAR(60)  NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS user_agent   TEXT         NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS ip           TEXT         NULL;

-- Workspace-level rollups used by the Reports/Analytics API.
CREATE INDEX IF NOT EXISTS idx_events_workspace_time ON email_events (workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_workspace_type ON email_events (workspace_id, type, occurred_at);
