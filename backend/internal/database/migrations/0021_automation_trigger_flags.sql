-- Per-automation trigger behavior. trigger_reentry controls whether a contact
-- who triggers again (re-import, repeat purchase) restarts the flow from step
-- one; trigger_respect_opt_out controls whether unsubscribed/bounced contacts
-- are skipped at enrollment. Both default to the safe, long-standing behavior.
ALTER TABLE automations
  ADD COLUMN trigger_reentry BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN trigger_respect_opt_out BOOLEAN NOT NULL DEFAULT TRUE;
