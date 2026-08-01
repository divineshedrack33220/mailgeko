-- Mailgeko initial schema (TiDB / MySQL compatible)

CREATE TABLE IF NOT EXISTS users (
    id               VARCHAR(36)  NOT NULL,
    email            VARCHAR(255) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    name             VARCHAR(120) NOT NULL,
    role             VARCHAR(40)  NOT NULL DEFAULT 'owner',
    email_verified_at TIMESTAMP   NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS workspaces (
    id         VARCHAR(36)  NOT NULL,
    name       VARCHAR(120) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id VARCHAR(36)  NOT NULL,
    user_id      VARCHAR(36)  NOT NULL,
    role         VARCHAR(40)  NOT NULL DEFAULT 'member',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id),
    KEY idx_wm_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Postgres (pgvector) analytic tables live in the Postgres instance.
-- Seed below is optional and used only in development.
