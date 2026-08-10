package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func restartServer(t *testing.T) (*httptest.Server, sqlmock.Sqlmock, *auth.TokenManager) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	sqlStore := store.New(sqlx.NewDb(db, "sqlmock"))
	eng := engine.New(sqlStore, nil, nil, "")
	mgr := auth.NewTokenManager("test-secret", time.Hour)
	srv := New(Config{}, sqlStore, nil, mgr, nil, nil, eng, nil, nil, nil)
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts, mock, mgr
}

func restartToken(t *testing.T, mgr *auth.TokenManager, role string) string {
	t.Helper()
	tok, err := mgr.Issue("user-1", "u@example.com", "ws", role)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func expectAutomationLookup(mock sqlmock.Sqlmock) {
	mock.ExpectQuery("SELECT role FROM workspace_members WHERE workspace_id = \\? AND user_id = \\?").
		WithArgs("ws", "user-1").WillReturnRows(sqlmock.NewRows([]string{"role"}).AddRow("owner"))
}

func TestRestartFailedAutomationRuns(t *testing.T) {
	ts, mock, mgr := restartServer(t)
	now := time.Now()

	expectAutomationLookup(mock)
	for i := 0; i < 2; i++ { // handler + engine each load the automation
		mock.ExpectQuery("SELECT id, workspace_id, name, .+ FROM automations WHERE workspace_id = \\? AND id = \\?").
			WithArgs("ws", "a1").
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "workspace_id", "name", "description", "trigger_type", "trigger_label",
				"trigger_conditions", "trigger_delay", "steps", "status", "created_at", "updated_at",
			}).AddRow("a1", "ws", "Welcome", "", "welcome", "New subscriber",
				[]byte("[]"), nil, []byte("[]"), "active", now, now))
	}
	mock.ExpectQuery("SELECT c.id, .+ JOIN automation_runs r").
		WithArgs("ws", "a1", store.AutomationRunFailed).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "workspace_id", "email", "first_name", "last_name", "company", "position",
			"country", "city", "phone_number", "custom_fields", "tags", "status",
			"last_engagement_at", "created_at", "updated_at",
		}).AddRow("c1", "ws", "a@b.co", "Ada", "Lovelace", "", "", "", "", "", nil, nil, "active", nil, now, now))
	mock.ExpectExec("INSERT INTO automation_runs").
		WithArgs(sqlmock.AnyArg(), "ws", "a1", "c1", 0, sqlmock.AnyArg(), store.AutomationRunActive).
		WillReturnResult(sqlmock.NewResult(0, 1))

	req, _ := http.NewRequest("POST", ts.URL+"/api/v1/automations/a1/restart-failed", nil)
	req.Header.Set("Authorization", "Bearer "+restartToken(t, mgr, "owner"))
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["restarted"].(float64) != 1 {
		t.Fatalf("restarted = %v, want 1", body["restarted"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRestartFailedAutomationRunsForbidden(t *testing.T) {
	ts, mock, mgr := restartServer(t)
	mock.ExpectQuery("SELECT role FROM workspace_members WHERE workspace_id = \\? AND user_id = \\?").
		WithArgs("ws", "user-1").WillReturnRows(sqlmock.NewRows([]string{"role"}).AddRow("manager"))

	req, _ := http.NewRequest("POST", ts.URL+"/api/v1/automations/a1/restart-failed", nil)
	req.Header.Set("Authorization", "Bearer "+restartToken(t, mgr, "manager"))
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "forbidden" {
		t.Fatalf("error = %q, want forbidden", body["error"])
	}
}

func TestRestartFailedAutomationRunsNotFound(t *testing.T) {
	ts, mock, mgr := restartServer(t)
	expectAutomationLookup(mock)
	mock.ExpectQuery("SELECT id, workspace_id, name, .+ FROM automations WHERE workspace_id = \\? AND id = \\?").
		WithArgs("ws", "a1").WillReturnError(sql.ErrNoRows)

	req, _ := http.NewRequest("POST", ts.URL+"/api/v1/automations/a1/restart-failed", nil)
	req.Header.Set("Authorization", "Bearer "+restartToken(t, mgr, "owner"))
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "not_found" {
		t.Fatalf("error = %q, want not_found", body["error"])
	}
}
