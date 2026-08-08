-- Bounds how many times a failing automation step is retried before the run
-- is marked failed, and records which automation run sent a campaign email so
-- an at-least-once retry does not re-send to the same contact.
ALTER TABLE automation_runs ADD COLUMN attempts INT NOT NULL DEFAULT 0;
ALTER TABLE campaign_recipients ADD COLUMN automation_run_id VARCHAR(36) NULL;
