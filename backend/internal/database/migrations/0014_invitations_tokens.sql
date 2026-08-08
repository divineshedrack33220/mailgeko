-- Mailgeko invitation acceptance tokens
-- Adds a lookup hash and expiry so invites can be redeemed by link.

ALTER TABLE invitations
    ADD COLUMN token_hash VARCHAR(64) NULL AFTER status,
    ADD COLUMN expires_at  TIMESTAMP  NULL AFTER token_hash;

CREATE INDEX idx_inv_token_hash ON invitations (token_hash);
