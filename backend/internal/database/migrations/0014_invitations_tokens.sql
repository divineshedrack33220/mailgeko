-- Mailgeko invitation acceptance tokens
-- Adds a lookup hash and expiry so invites can be redeemed by link.

ALTER TABLE invitations
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMP  NULL;

CREATE INDEX IF NOT EXISTS idx_inv_token_hash ON invitations (token_hash);
