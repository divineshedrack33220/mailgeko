-- Deletes automation runs whose contact no longer exists. Contacts deleted
-- before the DeleteContact cleanup fix left orphaned runs that stayed
-- "in flow" (active) forever and inflated automation stats.
DELETE r FROM automation_runs r
LEFT JOIN contacts c ON c.id = r.contact_id
WHERE c.id IS NULL;
