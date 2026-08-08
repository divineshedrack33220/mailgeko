CREATE TABLE IF NOT EXISTS automation_runs (
    id            VARCHAR(36)  NOT NULL,
    workspace_id  VARCHAR(36)  NOT NULL,
    automation_id VARCHAR(36)  NOT NULL,
    contact_id    VARCHAR(36)  NOT NULL,
    step_index    INT          NOT NULL DEFAULT 0,
    run_at        TIMESTAMP    NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ar_automation_contact (automation_id, contact_id),
    KEY idx_ar_workspace (workspace_id),
    KEY idx_ar_due (status, run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
