package store

import (
	"context"
	"os"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/go-sql-driver/mysql"
)

func TestManualListAutomationRunsLocal(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run the MySQL integration check")
	}
	db, err := sqlx.Connect("mysql", dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer db.Close()
	runs, err := New(db).ListAutomationRuns(context.Background(), "ws1", "a1")
	if err != nil {
		t.Fatalf("ListAutomationRuns: %v", err)
	}
	t.Logf("got %d runs", len(runs))
	for _, r := range runs {
		t.Logf("run %s contact=%s email=%s name=%q status=%s error=%q step=%d",
			r.ID, r.ContactID, r.ContactEmail, r.ContactName, r.Status, r.Error, r.StepIndex)
	}
}
