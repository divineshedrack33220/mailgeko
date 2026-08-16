package engine

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func newSQLMockStore(t *testing.T) (*store.Store, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return store.New(sqlx.NewDb(db, "sqlmock")), mock
}

func TestEnrollContactReentryDisabled(t *testing.T) {
	s, mock := newSQLMockStore(t)
	e := &Engine{store: s}
	ctx := context.Background()

	mock.ExpectQuery("SELECT 1 FROM automation_runs WHERE automation_id = \\? AND contact_id = \\? LIMIT 1").
		WithArgs("a1", "c1").
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))

	noReentry := &store.Automation{ID: "a1", WorkspaceID: "ws", Status: "active"}
	enrolled, err := e.enrollContact(ctx, noReentry, &store.Contact{ID: "c1", Email: "a@b.co"}, false)
	if err != nil {
		t.Fatalf("enrollContact: %v", err)
	}
	if enrolled {
		t.Fatal("an existing run must block re-enrollment when re-entry is disabled")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestEnrollContactReentryAllowedInsertsRun(t *testing.T) {
	s, mock := newSQLMockStore(t)
	e := &Engine{store: s}
	ctx := context.Background()

	mock.ExpectExec("INSERT INTO automation_runs").
		WithArgs(sqlmock.AnyArg(), "ws", "a1", "c1", 0, sqlmock.AnyArg(), store.AutomationRunActive).
		WillReturnResult(sqlmock.NewResult(1, 1))

	reentry := &store.Automation{
		ID:             "a1",
		WorkspaceID:    "ws",
		Status:         "active",
		TriggerReentry: true,
	}
	enrolled, err := e.enrollContact(ctx, reentry, &store.Contact{ID: "c1", Email: "a@b.co"}, false)
	if err != nil {
		t.Fatalf("enrollContact: %v", err)
	}
	if !enrolled {
		t.Fatal("a fresh contact should be enrolled")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestEnrollContactOptOutFlag(t *testing.T) {
	s, mock := newSQLMockStore(t)
	e := &Engine{store: s}
	ctx := context.Background()

	// Respecting opt-out: unsubscribed contacts are skipped without a run.
	mock.ExpectExec("INSERT INTO automation_runs").
		WillReturnResult(sqlmock.NewResult(1, 1))

	enroll := &store.Automation{
		ID:                   "a1",
		WorkspaceID:          "ws",
		Status:               "active",
		TriggerReentry:       true,
		TriggerRespectOptOut: false,
	}
	enrolled, err := e.enrollContact(ctx, enroll, &store.Contact{ID: "c1", Email: "a@b.co", Status: store.ContactUnsubscribed}, false)
	if err != nil {
		t.Fatalf("enrollContact: %v", err)
	}
	if !enrolled {
		t.Fatal("with opt-out disabled, unsubscribed contacts should still be enrolled")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
