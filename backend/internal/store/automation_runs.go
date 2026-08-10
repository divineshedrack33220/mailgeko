package store

import (
	"context"
	"database/sql"
	"time"
)

const (
	AutomationRunActive     = "active"
	AutomationRunProcessing = "processing"
	AutomationRunCompleted  = "completed"
	AutomationRunFailed     = "failed"
)

// AutomationRun tracks a single contact's progress through an automation
// flow. One row exists per (automation, contact); re-enrolling a contact
// resets the row back to the start of the flow.
type AutomationRun struct {
	ID           string
	WorkspaceID  string
	AutomationID string
	ContactID    string
	StepIndex    int
	RunAt        time.Time
	Status       string
	Attempts     int
	Error        string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// AutomationRunWithContact is an automation run joined with its contact, for
// surfacing per-contact progress and failure reasons in the UI.
type AutomationRunWithContact struct {
	AutomationRun
	ContactEmail string
	ContactName  string
}

// AutomationRunStats reports how many contacts are in-flight, finished, or
// failed for an automation. Used by the UI to show progress.
type AutomationRunStats struct {
	Active    int64
	Completed int64
	Failed    int64
}

type automationRunRow struct {
	ID           string         `db:"id"`
	WorkspaceID  string         `db:"workspace_id"`
	AutomationID string         `db:"automation_id"`
	ContactID    string         `db:"contact_id"`
	StepIndex    int            `db:"step_index"`
	RunAt        time.Time      `db:"run_at"`
	Status       string         `db:"status"`
	Attempts     int            `db:"attempts"`
	Error        sql.NullString `db:"error"`
	CreatedAt    time.Time      `db:"created_at"`
	UpdatedAt    time.Time      `db:"updated_at"`
}

func (r automationRunRow) toAutomationRun() *AutomationRun {
	return &AutomationRun{
		ID:           r.ID,
		WorkspaceID:  r.WorkspaceID,
		AutomationID: r.AutomationID,
		ContactID:    r.ContactID,
		StepIndex:    r.StepIndex,
		RunAt:        r.RunAt,
		Status:       r.Status,
		Attempts:     r.Attempts,
		Error:        r.Error.String,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

const automationRunColumns = `id, workspace_id, automation_id, contact_id, step_index, run_at,
	status, attempts, error, created_at, updated_at`

// CreateAutomationRun inserts a run, or resets an existing run for the same
// (automation, contact) back to the start of the flow. The run id is replaced
// on every enrollment so per-run idempotency markers (e.g. which run sent an
// email) do not leak across re-runs.
func (s *Store) CreateAutomationRun(ctx context.Context, r *AutomationRun) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO automation_runs (id, workspace_id, automation_id, contact_id, step_index, run_at, status)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE id = VALUES(id),
			workspace_id = VALUES(workspace_id),
			step_index = VALUES(step_index),
			run_at = VALUES(run_at),
			status = VALUES(status),
			error = NULL`,
		r.ID, r.WorkspaceID, r.AutomationID, r.ContactID, r.StepIndex, r.RunAt.UTC(), r.Status)
	return err
}

func (s *Store) GetAutomationRun(ctx context.Context, id string) (*AutomationRun, error) {
	var r automationRunRow
	err := s.db.GetContext(ctx, &r, `
		SELECT `+automationRunColumns+`
		FROM automation_runs WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	return r.toAutomationRun(), nil
}

// ListDueAutomationRuns returns runs that are ready to execute. Runs stuck in
// 'processing' beyond their lease (run_at) are included so a crashed worker
// doesn't strand a run forever.
func (s *Store) ListDueAutomationRuns(ctx context.Context, now time.Time, limit int) ([]*AutomationRun, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := s.db.QueryxContext(ctx, `
		SELECT `+automationRunColumns+`
		FROM automation_runs
		WHERE status IN ('active', 'processing')
		  AND run_at <= ?
		ORDER BY run_at ASC
		LIMIT ?`, now.UTC(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*AutomationRun
	for rows.Next() {
		var r automationRunRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toAutomationRun())
	}
	return out, rows.Err()
}

// ClaimAutomationRun atomically claims a due run so each run is enqueued
// exactly once even across multiple scheduler instances. It sets a lease so a
// run left 'processing' by a crashed worker is retried after the lease.
func (s *Store) ClaimAutomationRun(ctx context.Context, id string, now time.Time, lease time.Duration) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE automation_runs SET status = 'processing', run_at = ?
		 WHERE id = ? AND status IN ('active', 'processing') AND run_at <= ?`,
		now.Add(lease).UTC(), id, now.UTC())
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// AdvanceAutomationRun persists the run's next step after the executor
// finishes processing the current one. A successful advance resets the attempt
// counter so the retry budget applies per step.
func (s *Store) AdvanceAutomationRun(ctx context.Context, id, status string, stepIndex int, runAt time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE automation_runs SET status = ?, step_index = ?, run_at = ?, attempts = 0, error = NULL
		 WHERE id = ?`, status, stepIndex, runAt.UTC(), id)
	return err
}

// FailAutomationRun marks a run failed and records why. The reason is shown in
// the runs panel so a failure is never invisible to the owner.
func (s *Store) FailAutomationRun(ctx context.Context, id, error string, stepIndex int) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE automation_runs SET status = ?, step_index = ?, error = ?, attempts = 0
		 WHERE id = ?`, AutomationRunFailed, error, stepIndex, id)
	return err
}

// BumpAutomationRunAttempts increments the run's failure counter and returns
// the new count, used to bound how many times a failing step is retried.
func (s *Store) BumpAutomationRunAttempts(ctx context.Context, id string) (int, error) {
	if _, err := s.db.ExecContext(ctx,
		`UPDATE automation_runs SET attempts = attempts + 1 WHERE id = ?`, id); err != nil {
		return 0, err
	}
	var n int
	err := s.db.GetContext(ctx, &n, `SELECT attempts FROM automation_runs WHERE id = ?`, id)
	return n, err
}

// ListAutomationRuns returns the most recent runs for an automation joined
// with their contact, newest first. Used by the runs panel on the automation
// detail page.
func (s *Store) ListAutomationRuns(ctx context.Context, workspaceID, automationID string) ([]*AutomationRunWithContact, error) {
	rows, err := s.db.QueryxContext(ctx, `
		SELECT r.id, r.workspace_id, r.automation_id, r.contact_id, r.step_index, r.run_at,
			r.status, r.attempts, r.error, r.created_at, r.updated_at,
			COALESCE(c.email, '') AS contact_email,
			TRIM(CONCAT_WS(' ', COALESCE(c.first_name, ''), COALESCE(c.last_name, ''))) AS contact_name
		FROM automation_runs r
		LEFT JOIN contacts c ON c.id = r.contact_id
		WHERE r.workspace_id = ? AND r.automation_id = ?
		ORDER BY r.updated_at DESC
		LIMIT 500`, workspaceID, automationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*AutomationRunWithContact
	for rows.Next() {
		var row struct {
			automationRunRow
			ContactEmail string `db:"contact_email"`
			ContactName  string `db:"contact_name"`
		}
		if err := rows.StructScan(&row); err != nil {
			return nil, err
		}
		out = append(out, &AutomationRunWithContact{
			AutomationRun: *row.toAutomationRun(),
			ContactEmail:  row.ContactEmail,
			ContactName:   row.ContactName,
		})
	}
	return out, rows.Err()
}

// AutomationRunStats returns per-status counts for an automation.
func (s *Store) AutomationRunStats(ctx context.Context, automationID string) (*AutomationRunStats, error) {
	var stats AutomationRunStats
	rows, err := s.db.QueryxContext(ctx,
		`SELECT status, COUNT(*) FROM automation_runs WHERE automation_id = ? GROUP BY status`, automationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var n int64
		if err := rows.Scan(&status, &n); err != nil {
			return nil, err
		}
		switch status {
		case AutomationRunCompleted:
			stats.Completed = n
		case AutomationRunFailed:
			stats.Failed = n
		default:
			stats.Active = n
		}
	}
	return &stats, rows.Err()
}

// AutomationRunStatsByWorkspace returns per-automation run stats in one
// query, so the automation list page can show enrolled/progress without an
// N+1.
func (s *Store) AutomationRunStatsByWorkspace(ctx context.Context, workspaceID string) (map[string]*AutomationRunStats, error) {
	out := make(map[string]*AutomationRunStats)
	rows, err := s.db.QueryxContext(ctx,
		`SELECT automation_id, status, COUNT(*) FROM automation_runs
		 WHERE workspace_id = ? GROUP BY automation_id, status`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var automationID, status string
		var n int64
		if err := rows.Scan(&automationID, &status, &n); err != nil {
			return nil, err
		}
		st, ok := out[automationID]
		if !ok {
			st = &AutomationRunStats{}
			out[automationID] = st
		}
		switch status {
		case AutomationRunCompleted:
			st.Completed = n
		case AutomationRunFailed:
			st.Failed = n
		default:
			st.Active = n
		}
	}
	return out, rows.Err()
}
