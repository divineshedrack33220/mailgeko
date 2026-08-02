-- Two-factor authentication (TOTP) for users

ALTER TABLE users
    ADD COLUMN totp_secret VARCHAR(64) NULL,
    ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN totp_recovery_codes TEXT NULL;
