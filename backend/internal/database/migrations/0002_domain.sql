-- Mailgeko Phase 1 domain schema (TiDB / MySQL compatible)

CREATE TABLE IF NOT EXISTS contacts (
    id                 VARCHAR(36)  NOT NULL,
    workspace_id       VARCHAR(36)  NOT NULL,
    email              VARCHAR(255) NOT NULL,
    first_name         VARCHAR(120) NOT NULL DEFAULT '',
    last_name          VARCHAR(120) NOT NULL DEFAULT '',
    company            VARCHAR(180) NOT NULL DEFAULT '',
    position           VARCHAR(180) NOT NULL DEFAULT '',
    country            VARCHAR(120) NOT NULL DEFAULT '',
    city               VARCHAR(120) NOT NULL DEFAULT '',
    phone_number       VARCHAR(60)  NOT NULL DEFAULT '',
    custom_fields      JSON         NULL,
    tags               JSON         NULL,
    status             VARCHAR(20)  NOT NULL DEFAULT 'active',
    last_engagement_at TIMESTAMP    NULL,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_contacts_ws_email (workspace_id, email),
    KEY idx_contacts_status (workspace_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS lists (
    id           VARCHAR(36)  NOT NULL,
    workspace_id VARCHAR(36)  NOT NULL,
    name         VARCHAR(180) NOT NULL,
    description  VARCHAR(500) NOT NULL DEFAULT '',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_lists_ws_name (workspace_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS list_members (
    list_id    VARCHAR(36) NOT NULL,
    contact_id VARCHAR(36) NOT NULL,
    added_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, contact_id),
    KEY idx_lm_contact (contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS segments (
    id           VARCHAR(36)  NOT NULL,
    workspace_id VARCHAR(36)  NOT NULL,
    name         VARCHAR(180) NOT NULL,
    description  VARCHAR(500) NOT NULL DEFAULT '',
    match_type   VARCHAR(10)  NOT NULL DEFAULT 'all',
    conditions   JSON         NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_segments_ws_name (workspace_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS templates (
    id           VARCHAR(36)  NOT NULL,
    workspace_id VARCHAR(36)  NOT NULL,
    name         VARCHAR(180) NOT NULL,
    description  VARCHAR(500) NOT NULL DEFAULT '',
    category     VARCHAR(40)  NOT NULL DEFAULT 'Newsletter',
    thumbnail    VARCHAR(40)  NOT NULL DEFAULT 'newsletter',
    mjml         LONGTEXT     NULL,
    html         LONGTEXT     NOT NULL,
    variables    JSON         NULL,
    tags         JSON         NULL,
    is_favorite  TINYINT(1)   NOT NULL DEFAULT 0,
    used_count   BIGINT       NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS campaigns (
    id                VARCHAR(36)  NOT NULL,
    workspace_id      VARCHAR(36)  NOT NULL,
    name              VARCHAR(180) NOT NULL,
    subject           VARCHAR(500) NOT NULL,
    template_id       VARCHAR(36)  NULL,
    preview_text      VARCHAR(500) NOT NULL DEFAULT '',
    plain_text        LONGTEXT     NULL,
    html_content      LONGTEXT     NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'draft',
    type              VARCHAR(20)  NOT NULL DEFAULT 'regular',
    list_ids          JSON         NULL,
    segment_ids       JSON         NULL,
    schedule_at       TIMESTAMP    NULL,
    from_name         VARCHAR(180) NOT NULL DEFAULT '',
    from_email        VARCHAR(255) NOT NULL DEFAULT '',
    reply_to          VARCHAR(255) NOT NULL DEFAULT '',
    track_opens       TINYINT(1)   NOT NULL DEFAULT 1,
    track_clicks      TINYINT(1)   NOT NULL DEFAULT 1,
    allow_unsubscribe TINYINT(1)   NOT NULL DEFAULT 1,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_campaigns_status (workspace_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS campaign_stats (
    campaign_id  VARCHAR(36) NOT NULL,
    recipients   BIGINT      NOT NULL DEFAULT 0,
    sent         BIGINT      NOT NULL DEFAULT 0,
    delivered    BIGINT      NOT NULL DEFAULT 0,
    opened       BIGINT      NOT NULL DEFAULT 0,
    clicked      BIGINT      NOT NULL DEFAULT 0,
    bounced      BIGINT      NOT NULL DEFAULT 0,
    complained   BIGINT      NOT NULL DEFAULT 0,
    unsubscribed BIGINT      NOT NULL DEFAULT 0,
    unique_opens BIGINT      NOT NULL DEFAULT 0,
    unique_clicks BIGINT     NOT NULL DEFAULT 0,
    PRIMARY KEY (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS campaign_recipients (
    campaign_id      VARCHAR(36)  NOT NULL,
    contact_id       VARCHAR(36)  NOT NULL,
    resend_message_id VARCHAR(255) NOT NULL DEFAULT '',
    status           VARCHAR(20)  NOT NULL DEFAULT 'queued',
    error            VARCHAR(500) NOT NULL DEFAULT '',
    sent_at          TIMESTAMP    NULL,
    delivered_at     TIMESTAMP    NULL,
    opened_at        TIMESTAMP    NULL,
    clicked_at       TIMESTAMP    NULL,
    bounced_at       TIMESTAMP    NULL,
    complained_at    TIMESTAMP    NULL,
    unsubscribed_at  TIMESTAMP    NULL,
    PRIMARY KEY (campaign_id, contact_id),
    KEY idx_cr_message (resend_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS automations (
    id                  VARCHAR(36)  NOT NULL,
    workspace_id        VARCHAR(36)  NOT NULL,
    name                VARCHAR(180) NOT NULL,
    description         VARCHAR(500) NOT NULL DEFAULT '',
    trigger_type        VARCHAR(40)  NOT NULL DEFAULT 'custom',
    trigger_label       VARCHAR(255) NOT NULL DEFAULT '',
    trigger_conditions  JSON         NULL,
    trigger_delay       INT          NULL,
    steps               JSON         NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'draft',
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
