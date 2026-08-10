-- Records why an automation run was marked failed, so the failure reason can
-- be surfaced in the UI instead of being lost to the logs.
ALTER TABLE automation_runs ADD COLUMN error TEXT NULL;
