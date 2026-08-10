package store

import (
	"context"
	"os"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/go-sql-driver/mysql"
)

// TestMySQLAutomationRunJoin is an opt-in integration check for the
// automation-runs ↔ contacts join that backs the runs panel. It bootstraps
// the two tables itself, so it runs against a fresh MySQL in CI (mysql:8
// service container) or any TEST_MYSQL_DSN. It exists because a previous
// regression (ambiguous `id` column across the JOIN) only surfaced at runtime
// in production.
func TestMySQLAutomationRunJoin(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run the MySQL integration check")
	}
	db, err := sqlx.Connect("mysql", dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	ctx := context.Background()
	s := New(db)

	ws := "ws-" + t.Name()
	if _, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS automation_runs`); err != nil {
		t.Fatalf("drop runs: %v", err)
	}
	if _, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS contacts`); err != nil {
		t.Fatalf("drop contacts: %v", err)
	}
	for _, stmt := range []string{
		`CREATE TABLE IF NOT EXISTS contacts (
			id VARCHAR(36) PRIMARY KEY,
			workspace_id VARCHAR(36) NOT NULL,
			email VARCHAR(255) NOT NULL,
			first_name VARCHAR(120) NOT NULL DEFAULT '',
			last_name VARCHAR(120) NOT NULL DEFAULT '',
			company VARCHAR(180) NOT NULL DEFAULT '',
			position VARCHAR(180) NOT NULL DEFAULT '',
			country VARCHAR(120) NOT NULL DEFAULT '',
			city VARCHAR(120) NOT NULL DEFAULT '',
			phone_number VARCHAR(60) NOT NULL DEFAULT '',
			custom_fields JSON NULL,
			tags JSON NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			last_engagement_at TIMESTAMP NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
		`CREATE TABLE IF NOT EXISTS automation_runs (
			id VARCHAR(36) PRIMARY KEY,
			workspace_id VARCHAR(36) NOT NULL,
			automation_id VARCHAR(36) NOT NULL,
			contact_id VARCHAR(36) NOT NULL,
			step_index INT NOT NULL DEFAULT 0,
			run_at TIMESTAMP NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			attempts INT NOT NULL DEFAULT 0,
			error TEXT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
	} {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			t.Fatalf("bootstrap: %v", err)
		}
	}
	if _, err := db.ExecContext(ctx, `DELETE FROM automation_runs WHERE workspace_id = ?`, ws); err != nil {
		t.Fatalf("cleanup runs: %v", err)
	}
	if _, err := db.ExecContext(ctx, `DELETE FROM contacts WHERE workspace_id = ?`, ws); err != nil {
		t.Fatalf("cleanup contacts: %v", err)
	}
	if _, err := db.ExecContext(ctx,
		`INSERT INTO contacts (id, workspace_id, email, first_name, last_name, status)
		 VALUES ('c1', ?, 'a@b.co', 'Ada', 'Lovelace', 'active')`, ws); err != nil {
		t.Fatalf("insert contact: %v", err)
	}
	if _, err := db.ExecContext(ctx,
		`INSERT INTO automation_runs (id, workspace_id, automation_id, contact_id, step_index, run_at, status, attempts, error)
		 VALUES ('r1', ?, 'a1', 'c1', 2, NOW(), 'failed', 10, 'smtp: connection refused')`, ws); err != nil {
		t.Fatalf("insert run: %v", err)
	}

	runs, err := s.ListAutomationRuns(ctx, ws, "a1")
	if err != nil {
		t.Fatalf("ListAutomationRuns: %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("expected 1 run, got %d", len(runs))
	}
	r := runs[0]
	if r.Status != AutomationRunFailed || r.Attempts != 10 || r.Error != "smtp: connection refused" {
		t.Errorf("run fields wrong: status=%s attempts=%d error=%q", r.Status, r.Attempts, r.Error)
	}
	if r.ContactEmail != "a@b.co" || r.ContactName != "Ada Lovelace" {
		t.Errorf("contact join wrong: email=%q name=%q", r.ContactEmail, r.ContactName)
	}
	if r.StepIndex != 2 {
		t.Errorf("stepIndex = %d, want 2", r.StepIndex)
	}

	// A second workspace must not leak rows across the join.
	other, err := s.ListAutomationRuns(ctx, "ws-nope", "a1")
	if err != nil {
		t.Fatalf("ListAutomationRuns(other): %v", err)
	}
	if len(other) != 0 {
		t.Fatalf("expected 0 runs for other workspace, got %d", len(other))
	}

	// ListFailedRunContacts returns the failed contact, joined through runs.
	contacts, err := s.ListFailedRunContacts(ctx, ws, "a1")
	if err != nil {
		t.Fatalf("ListFailedRunContacts: %v", err)
	}
	if len(contacts) != 1 {
		t.Fatalf("expected 1 failed contact, got %d", len(contacts))
	}
	if contacts[0].Email != "a@b.co" {
		t.Errorf("failed contact email = %q, want a@b.co", contacts[0].Email)
	}
	if got, err := s.ListFailedRunContacts(ctx, "ws-nope", "a1"); err != nil {
		t.Fatalf("ListFailedRunContacts(other): %v", err)
	} else if len(got) != 0 {
		t.Fatalf("expected 0 failed contacts for other workspace, got %d", len(got))
	}
}
