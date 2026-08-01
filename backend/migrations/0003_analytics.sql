-- Mailgeko Phase 1 analytics schema (Postgres + pgvector)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS email_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id VARCHAR(36) NOT NULL,
    campaign_id  VARCHAR(36) NOT NULL,
    contact_id   VARCHAR(36) NOT NULL,
    type         VARCHAR(30) NOT NULL,
    url          TEXT        NULL,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_campaign_type ON email_events (campaign_id, type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_contact ON email_events (contact_id);

-- Contact embeddings for vector search (populated in Phase 2).
CREATE TABLE IF NOT EXISTS contact_embeddings (
    contact_id   VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    embedding    vector(384) NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
