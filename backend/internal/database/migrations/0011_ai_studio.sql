-- AI Studio: generation history and workspace brand voice

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS brand_voice TEXT NULL;

CREATE TABLE IF NOT EXISTS ai_history (
    id           VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    kind         VARCHAR(32) NOT NULL,
    prompt       TEXT        NULL,
    result       TEXT        NULL,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ai_history_workspace_created (workspace_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
