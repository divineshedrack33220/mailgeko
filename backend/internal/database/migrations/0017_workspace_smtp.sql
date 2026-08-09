-- Mailgeko bring-your-own-SMTP (TiDB / MySQL compatible)

CREATE TABLE IF NOT EXISTS workspace_smtp (
    workspace_id     VARCHAR(36)  NOT NULL,
    host             VARCHAR(255) NOT NULL,
    port             INT          NOT NULL DEFAULT 587,
    username         VARCHAR(255) NOT NULL DEFAULT '',
    password_cipher  BLOB         NULL,
    from_name        VARCHAR(120) NOT NULL DEFAULT '',
    from_email       VARCHAR(255) NOT NULL DEFAULT '',
    reply_to         VARCHAR(255) NOT NULL DEFAULT '',
    enabled          TINYINT(1)   NOT NULL DEFAULT 0,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
