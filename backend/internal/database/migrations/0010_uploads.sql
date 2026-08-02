-- Mailgeko profile avatars, workspace logos, and OAuth identities

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(40) NULL,
    ADD COLUMN IF NOT EXISTS oauth_uid VARCHAR(128) NULL;

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL;
