-- Mailgeko sending defaults (TiDB / MySQL compatible)

ALTER TABLE workspaces
    ADD COLUMN from_name VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN from_email VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN reply_to VARCHAR(255) NOT NULL DEFAULT '';
