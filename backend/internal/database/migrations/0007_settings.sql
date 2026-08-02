-- Mailgeko settings schema (TiDB / MySQL compatible)

CREATE TABLE IF NOT EXISTS invitations (
    id           VARCHAR(36)  NOT NULL,
    workspace_id VARCHAR(36)  NOT NULL,
    email        VARCHAR(255) NOT NULL,
    role         VARCHAR(40)  NOT NULL DEFAULT 'member',
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invitations_ws_email (workspace_id, email),
    KEY idx_inv_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS api_keys (
    id           VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name         VARCHAR(120) NOT NULL,
    prefix       VARCHAR(20) NOT NULL,
    key_hash     VARCHAR(255) NOT NULL,
    scopes       TEXT        NULL,
    last_used_at TIMESTAMP   NULL,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ak_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id    VARCHAR(36) NOT NULL,
    pref_key   VARCHAR(60) NOT NULL,
    value      VARCHAR(20) NOT NULL DEFAULT '1',
    updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, pref_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
