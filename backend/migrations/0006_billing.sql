-- Mailgeko billing schema (TiDB / MySQL compatible)

ALTER TABLE workspaces
    ADD COLUMN plan VARCHAR(40) NOT NULL DEFAULT 'starter',
    ADD COLUMN stripe_customer_id VARCHAR(255) NULL,
    ADD COLUMN stripe_subscription_id VARCHAR(255) NULL,
    ADD COLUMN stripe_subscription_status VARCHAR(40) NULL,
    ADD COLUMN subscription_period_end TIMESTAMP NULL;
