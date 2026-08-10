package store

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newSQLMockStore(t *testing.T) (*Store, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return New(sqlx.NewDb(db, "sqlmock")), mock
}

func contactRowColumns() []string {
	return []string{
		"id", "workspace_id", "email", "first_name", "last_name", "company", "position",
		"country", "city", "phone_number", "custom_fields", "tags", "status",
		"last_engagement_at", "created_at", "updated_at",
	}
}

func TestListFailedRunContacts(t *testing.T) {
	s, mock := newSQLMockStore(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT c.id, c.workspace_id, c.email, c.first_name, .+ FROM contacts c JOIN automation_runs r").
		WithArgs("ws", "a1", AutomationRunFailed).
		WillReturnRows(sqlmock.NewRows(contactRowColumns()).
			AddRow("c1", "ws", "a@b.co", "Ada", "Lovelace", "ACME", "Founder", "US", "SF",
				"+1", nil, []byte(`["vip","trial"]`), "active", nil, now, now))

	contacts, err := s.ListFailedRunContacts(context.Background(), "ws", "a1")
	if err != nil {
		t.Fatalf("ListFailedRunContacts: %v", err)
	}
	if len(contacts) != 1 {
		t.Fatalf("expected 1 contact, got %d", len(contacts))
	}
	c := contacts[0]
	if c.Email != "a@b.co" || c.FirstName != "Ada" || c.LastName != "Lovelace" || c.Company != "ACME" {
		t.Fatalf("contact fields wrong: %+v", c)
	}
	if len(c.Tags) != 2 || c.Tags[0] != "vip" || c.Tags[1] != "trial" {
		t.Fatalf("tags wrong: %v", c.Tags)
	}
	if c.Status != "active" {
		t.Fatalf("status wrong: %s", c.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListFailedRunContactsEmpty(t *testing.T) {
	s, mock := newSQLMockStore(t)
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", AutomationRunFailed).
		WillReturnRows(sqlmock.NewRows(contactRowColumns()))

	contacts, err := s.ListFailedRunContacts(context.Background(), "ws", "a1")
	if err != nil {
		t.Fatalf("ListFailedRunContacts: %v", err)
	}
	if len(contacts) != 0 {
		t.Fatalf("expected no contacts, got %d", len(contacts))
	}
}

func TestListFailedRunContactsError(t *testing.T) {
	s, mock := newSQLMockStore(t)
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", AutomationRunFailed).
		WillReturnError(errors.New("boom"))

	if _, err := s.ListFailedRunContacts(context.Background(), "ws", "a1"); err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestListFailedRunContactsScopesToFailedOnly(t *testing.T) {
	s, mock := newSQLMockStore(t)
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", AutomationRunFailed).
		WillReturnRows(sqlmock.NewRows(contactRowColumns()).
			AddRow("c1", "ws", "active@b.co", "", "", "", "", "", "", "", nil, nil, "active", nil, time.Now(), time.Now()).
			AddRow("c2", "ws", "done@b.co", "", "", "", "", "", "", "", nil, nil, "active", nil, time.Now(), time.Now()))

	contacts, err := s.ListFailedRunContacts(context.Background(), "ws", "a1")
	if err != nil {
		t.Fatalf("ListFailedRunContacts: %v", err)
	}
	// Only the status filter mattered in the WHERE; both rows are returned
	// because the mock supplied them. This guards the query shape (join + the
	// failed-status argument).
	if len(contacts) != 2 {
		t.Fatalf("expected 2 contacts, got %d", len(contacts))
	}
}

func TestGetAutomationRunNotFound(t *testing.T) {
	s, mock := newSQLMockStore(t)
	mock.ExpectQuery("SELECT id, workspace_id, automation_id, .+ FROM automation_runs WHERE id = \\?").
		WithArgs("nope").
		WillReturnError(sql.ErrNoRows)

	run, err := s.GetAutomationRun(context.Background(), "nope")
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
	if run != nil {
		t.Fatalf("expected nil run, got %+v", run)
	}
}
