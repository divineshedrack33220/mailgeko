-- Mailgeko billing schema (TiDB / MySQL compatible)

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS plan VARCHAR(40) NOT NULL DEFAULT 'starter',
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(40) NULL,
    ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP NULL;
