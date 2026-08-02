CREATE TABLE IF NOT EXISTS notifications (
    id           VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    user_id      VARCHAR(36) NOT NULL,
    type         VARCHAR(40) NOT NULL DEFAULT 'general',
    title        VARCHAR(255) NOT NULL,
    body         TEXT        NULL,
    link         VARCHAR(255) NULL,
    read_at      TIMESTAMP   NULL,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_workspace_created (workspace_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
