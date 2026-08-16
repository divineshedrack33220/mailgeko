package engine

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func restartTestEngine(t *testing.T) (*Engine, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return New(store.New(sqlx.NewDb(db, "sqlmock")), nil, nil, ""), mock
}

func automationColumns() []string {
	return []string{
		"id", "workspace_id", "name", "description", "trigger_type", "trigger_label",
		"trigger_conditions", "trigger_delay", "trigger_reentry", "trigger_respect_opt_out",
		"steps", "status", "created_at", "updated_at",
	}
}

func contactColumns() []string {
	return []string{
		"id", "workspace_id", "email", "first_name", "last_name", "company", "position",
		"country", "city", "phone_number", "custom_fields", "tags", "status",
		"last_engagement_at", "created_at", "updated_at",
	}
}

func automationRow(triggerDelay int, hasDelay bool) *sqlmock.Rows {
	rows := sqlmock.NewRows(automationColumns())
	if hasDelay {
		return rows.AddRow("a1", "ws", "Welcome", "", "welcome", "New subscriber",
			[]byte("[]"), triggerDelay, true, true, []byte("[]"), "active", time.Now(), time.Now())
	}
	return rows.AddRow("a1", "ws", "Welcome", "", "welcome", "New subscriber",
		[]byte("[]"), nil, true, true, []byte("[]"), "active", time.Now(), time.Now())
}

func contactRow(id, email, status string) *sqlmock.Rows {
	return sqlmock.NewRows(contactColumns()).
		AddRow(id, "ws", email, "Ada", "Lovelace", "", "", "", "", "", nil, nil, status, nil, time.Now(), time.Now())
}

type runAtMatcher struct{ got *time.Time }

func (m runAtMatcher) Match(v driver.Value) bool {
	if t, ok := v.(time.Time); ok {
		*m.got = t
	}
	return true
}

func TestRestartFailedRunsReenrollsFailedContacts(t *testing.T) {
	e, mock := restartTestEngine(t)
	ctx := context.Background()
	now := time.Now()

	mock.ExpectQuery("SELECT id, workspace_id, name, .+ FROM automations WHERE workspace_id = \\? AND id = \\?").
		WithArgs("ws", "a1").WillReturnRows(automationRow(3, true))
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", store.AutomationRunFailed).
		WillReturnRows(sqlmock.NewRows(contactColumns()).
			AddRow("c1", "ws", "a@b.co", "Ada", "Lovelace", "", "", "", "", "", nil, nil, "active", nil, time.Now(), time.Now()).
			AddRow("c2", "ws", "b@b.co", "Bob", "Baker", "", "", "", "", "", nil, nil, "active", nil, time.Now(), time.Now()))

	var gotRunAt time.Time
	mock.ExpectExec("INSERT INTO automation_runs").
		WithArgs(sqlmock.AnyArg(), "ws", "a1", "c1", 0, runAtMatcher{&gotRunAt}, store.AutomationRunActive).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO automation_runs").
		WithArgs(sqlmock.AnyArg(), "ws", "a1", "c2", 0, runAtMatcher{&gotRunAt}, store.AutomationRunActive).
		WillReturnResult(sqlmock.NewResult(0, 1))

	restarted, err := e.RestartFailedRuns(ctx, "ws", "a1")
	if err != nil {
		t.Fatalf("RestartFailedRuns: %v", err)
	}
	if restarted != 2 {
		t.Fatalf("restarted = %d, want 2", restarted)
	}
	// The trigger delay (3h) is re-applied on restart, resetting the run to
	// the start of the flow instead of resuming where it failed.
	if gotRunAt.Before(now.Add(2*time.Hour)) || gotRunAt.After(now.Add(4*time.Hour)) {
		t.Fatalf("runAt = %v, want ~now+3h", gotRunAt)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRestartFailedRunsSkipsOptedOut(t *testing.T) {
	e, mock := restartTestEngine(t)
	ctx := context.Background()

	mock.ExpectQuery("SELECT id, workspace_id, name, .+ FROM automations WHERE workspace_id = \\? AND id = \\?").
		WithArgs("ws", "a1").WillReturnRows(automationRow(0, false))
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", store.AutomationRunFailed).
		WillReturnRows(contactRow("c1", "u@b.co", store.ContactUnsubscribed))

	restarted, err := e.RestartFailedRuns(ctx, "ws", "a1")
	if err != nil {
		t.Fatalf("RestartFailedRuns: %v", err)
	}
	if restarted != 0 {
		t.Fatalf("restarted = %d, want 0 (opted-out skipped)", restarted)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations (an insert should not have been made): %v", err)
	}
}

func TestRestartFailedRunsGetAutomationError(t *testing.T) {
	e, mock := restartTestEngine(t)
	mock.ExpectQuery("SELECT id, workspace_id, name, .+ FROM automations WHERE workspace_id = \\? AND id = \\?").
		WithArgs("ws", "a1").WillReturnError(errors.New("boom"))

	restarted, err := e.RestartFailedRuns(context.Background(), "ws", "a1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if restarted != 0 {
		t.Fatalf("restarted = %d, want 0", restarted)
	}
}

func TestRestartFailedRunsListError(t *testing.T) {
	e, mock := restartTestEngine(t)
	mock.ExpectQuery("SELECT id, workspace_id, name, .+ FROM automations WHERE workspace_id = \\? AND id = \\?").
		WithArgs("ws", "a1").WillReturnRows(automationRow(0, false))
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", store.AutomationRunFailed).WillReturnError(errors.New("boom"))

	restarted, err := e.RestartFailedRuns(context.Background(), "ws", "a1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if restarted != 0 {
		t.Fatalf("restarted = %d, want 0", restarted)
	}
}

func TestRestartFailedRunsBestEffortPerContact(t *testing.T) {
	e, mock := restartTestEngine(t)
	ctx := context.Background()

	mock.ExpectQuery("SELECT id, workspace_id, name, .+ FROM automations WHERE workspace_id = \\? AND id = \\?").
		WithArgs("ws", "a1").WillReturnRows(automationRow(0, false))
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", store.AutomationRunFailed).
		WillReturnRows(contactRow("c1", "a@b.co", "active"))
	mock.ExpectExec("INSERT INTO automation_runs").
		WithArgs(sqlmock.AnyArg(), "ws", "a1", "c1", 0, sqlmock.AnyArg(), store.AutomationRunActive).
		WillReturnError(errors.New("insert failed"))

	// A failing re-enroll does not fail the whole restart; the remaining
	// contacts are still attempted and the error is not propagated.
	restarted, err := e.RestartFailedRuns(ctx, "ws", "a1")
	if err != nil {
		t.Fatalf("RestartFailedRuns should be best-effort, got %v", err)
	}
	if restarted != 0 {
		t.Fatalf("restarted = %d, want 0", restarted)
	}
}
