package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func TestAutomationRunResponse(t *testing.T) {
	now := time.Now()
	run := &store.AutomationRunWithContact{
		AutomationRun: store.AutomationRun{
			ID:        "r1",
			Status:    store.AutomationRunFailed,
			ContactID: "c1",
			StepIndex: 2,
			Attempts:  10,
			Error:     "smtp: connection refused",
			RunAt:     now,
			UpdatedAt: now,
		},
		ContactEmail: "a@b.co",
		ContactName:  "Ada Lovelace",
	}
	resp := automationRunResponse(run)
	if resp["status"] != store.AutomationRunFailed || resp["error"] != "smtp: connection refused" {
		t.Fatalf("status/error wrong: %v", resp)
	}
	c := resp["contact"].(map[string]any)
	if c["email"] != "a@b.co" || c["name"] != "Ada Lovelace" {
		t.Fatalf("contact wrong: %v", c)
	}
	if resp["attempts"] != 10 || resp["stepIndex"] != 2 {
		t.Fatalf("step/attempts wrong: %v", resp)
	}
}

func intPtr(v int) *int { return &v }

func TestNormalizeSteps(t *testing.T) {
	for _, b := range [][]byte{nil, []byte(""), []byte("null")} {
		if got := string(normalizeSteps(b)); got != "[]" {
			t.Fatalf("normalizeSteps(%q) = %s, want []", b, got)
		}
	}
	in := []byte(`[{"id":"n1"}]`)
	if got := string(normalizeSteps(in)); got != string(in) {
		t.Fatalf("normalizeSteps should pass through valid steps, got %s", got)
	}
}

func TestAutomationResponseShape(t *testing.T) {
	now := time.Now()
	a := &store.Automation{
		ID:                "a1",
		WorkspaceID:       "ws",
		Name:              "Welcome series",
		Description:       "desc",
		TriggerType:       "welcome",
		TriggerLabel:      "New subscriber",
		TriggerConditions: []store.Condition{{ID: "c1", Field: "email", Operator: "contains", Value: "@"}},
		TriggerDelay:      intPtr(2),
		Steps:             []byte(`[{"id":"n1","type":"send-email"}]`),
		Status:            "active",
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	resp := automationResponse(a)
	trig := resp["trigger"].(map[string]any)
	if trig["type"] != "welcome" || trig["delay"].(*int) == nil {
		t.Fatalf("trigger shape wrong: %v", trig)
	}
	if conds := trig["conditions"].([]store.Condition); len(conds) != 1 || conds[0].Field != "email" {
		t.Fatalf("conditions wrong: %v", conds)
	}
	if resp["steps"] == nil {
		t.Fatal("steps must not be nil")
	}
	if resp["createdAt"].(string) != now.UTC().Format(time.RFC3339) {
		t.Fatalf("createdAt format wrong: %v", resp["createdAt"])
	}
}

func TestAutomationResponseWithStats(t *testing.T) {
	a := &store.Automation{ID: "a1", Name: "A", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	stats := &store.AutomationRunStats{Active: 2, Completed: 4, Failed: 1}
	resp := automationResponseWithStats(a, stats)
	if resp["contacts"] != int64(2) || resp["activeCount"] != int64(2) ||
		resp["completedCount"] != int64(4) || resp["failedCount"] != int64(1) {
		t.Fatalf("stats not surfaced: %v", resp)
	}
	// nil stats must not panic and should omit the keys.
	resp = automationResponseWithStats(a, nil)
	if _, ok := resp["contacts"]; ok {
		t.Fatal("nil stats should not add contact keys")
	}
}

func TestAutomationResponseNoTriggerDelay(t *testing.T) {
	a := &store.Automation{ID: "a1", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	resp := automationResponse(a)
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(b), `"delay":null`) {
		t.Fatalf("unset trigger delay should serialize as null, got %s", b)
	}
}
