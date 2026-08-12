package engine

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func TestFilterWelcomeAutomations(t *testing.T) {
	automations := []*store.Automation{
		{ID: "a1", TriggerType: "welcome"},
		{ID: "a2", TriggerType: "form"},
		{ID: "a3", TriggerType: "welcome"},
	}
	got := filterWelcomeAutomations(automations)
	if len(got) != 2 || got[0].ID != "a1" || got[1].ID != "a3" {
		t.Fatalf("filterWelcomeAutomations = %v, want a1,a3", got)
	}
}

func TestParseAutomationSteps(t *testing.T) {
	steps, err := parseAutomationSteps(nil)
	if err != nil || len(steps) != 0 {
		t.Fatalf("nil steps: %v %v", steps, err)
	}
	steps, err = parseAutomationSteps([]byte("null"))
	if err != nil || len(steps) != 0 {
		t.Fatalf("null steps: %v %v", steps, err)
	}
	steps, err = parseAutomationSteps([]byte(`[{"id":"n1","type":"send-email","label":"Email","config":{"campaignId":"c1"}}]`))
	if err != nil || len(steps) != 1 {
		t.Fatalf("valid steps: %v %v", steps, err)
	}
	if steps[0].Config["campaignId"] != "c1" {
		t.Fatalf("config not preserved: %v", steps[0].Config)
	}
	if _, err := parseAutomationSteps([]byte(`not json`)); err == nil {
		t.Fatal("invalid json should error")
	}
}

func TestConditionStepTag(t *testing.T) {
	e := &Engine{}
	ctx := context.Background()
	contact := &store.Contact{Tags: []string{"vip", "trial"}}

	if m, err := e.conditionStep(ctx, contact, map[string]any{"condition": "tag", "tag": "vip"}); err != nil || !m {
		t.Fatalf("contact with tag should match, got %v %v", m, err)
	}
	if m, _ := e.conditionStep(ctx, contact, map[string]any{"condition": "tag", "tag": "nope"}); m {
		t.Fatal("contact without tag should not match")
	}
	if m, _ := e.conditionStep(ctx, contact, map[string]any{"condition": "tag"}); m {
		t.Fatal("missing tag should not match")
	}
}

func TestConditionStepUnconfiguredBranches(t *testing.T) {
	e := &Engine{}
	ctx := context.Background()
	contact := &store.Contact{}

	// opened/clicked without a campaign: no store access, short-circuits.
	if m, _ := e.conditionStep(ctx, contact, map[string]any{"condition": "opened"}); m {
		t.Fatal("opened without campaign should not match")
	}
	if m, _ := e.conditionStep(ctx, contact, map[string]any{"condition": "clicked"}); m {
		t.Fatal("clicked without campaign should not match")
	}
	// segment without a segment id: no store access, short-circuits.
	if m, _ := e.conditionStep(ctx, contact, map[string]any{"condition": "segment"}); m {
		t.Fatal("segment without id should not match")
	}
	// unknown / empty conditions always resolve false.
	if m, _ := e.conditionStep(ctx, contact, map[string]any{"condition": "magic"}); m {
		t.Fatal("unknown condition should not match")
	}
	if m, _ := e.conditionStep(ctx, contact, map[string]any{}); m {
		t.Fatal("empty config should not match")
	}
}

func TestAddTagShortCircuits(t *testing.T) {
	e := &Engine{}
	ctx := context.Background()
	contact := &store.Contact{Tags: []string{"vip"}}

	if err := e.addTagStep(ctx, contact, nil); err != nil {
		t.Fatalf("nil config should no-op: %v", err)
	}
	if err := e.addTagStep(ctx, contact, map[string]any{"tag": ""}); err != nil {
		t.Fatalf("empty tag should no-op: %v", err)
	}
	// Tag already present: no store write, tags unchanged.
	if err := e.addTagStep(ctx, contact, map[string]any{"tag": "vip"}); err != nil {
		t.Fatalf("existing tag should no-op: %v", err)
	}
	if len(contact.Tags) != 1 {
		t.Fatalf("tags mutated: %v", contact.Tags)
	}
}

func TestRemoveTagShortCircuit(t *testing.T) {
	e := &Engine{}
	ctx := context.Background()
	contact := &store.Contact{Tags: []string{"vip"}}

	if err := e.removeTagStep(ctx, contact, map[string]any{"tag": ""}); err != nil {
		t.Fatalf("empty tag should no-op: %v", err)
	}
	if len(contact.Tags) != 1 {
		t.Fatalf("tags mutated: %v", contact.Tags)
	}
}

func TestEnrollContactSkipsInactiveAndOptedOut(t *testing.T) {
	e := &Engine{}
	ctx := context.Background()
	inactive := &store.Automation{ID: "a1", Status: "draft"}
	if err := e.EnrollContact(ctx, inactive, &store.Contact{ID: "c1", Email: "a@b.co"}); err != nil {
		t.Fatalf("inactive automation should be skipped: %v", err)
	}
	active := &store.Automation{ID: "a2", Status: "active"}
	for _, status := range []string{store.ContactUnsubscribed, store.ContactBounced, store.ContactSpam} {
		if err := e.EnrollContact(ctx, active, &store.Contact{ID: "c1", Email: "a@b.co", Status: status}); err != nil {
			t.Fatalf("opted-out contact (%s) should be skipped: %v", status, err)
		}
	}
}

func TestSendEmailStepSkipsUnconfigured(t *testing.T) {
	e := &Engine{}
	ctx := context.Background()
	automation := &store.Automation{ID: "a1", Name: "A", WorkspaceID: "ws"}
	contact := &store.Contact{ID: "c1", Email: "a@b.co"}

	if err := e.sendEmailStep(ctx, "run1", automation, contact, nil); err != nil {
		t.Fatalf("missing campaignId should skip cleanly: %v", err)
	}
	// Opted-out contact skips before any campaign lookup.
	unsub := &store.Contact{ID: "c2", Email: "u@b.co", Status: store.ContactUnsubscribed}
	if err := e.sendEmailStep(ctx, "run2", automation, unsub, map[string]any{"campaignId": "c1"}); err != nil {
		t.Fatalf("opted-out contact should skip cleanly: %v", err)
	}
}

func TestWebhookStepPostsContact(t *testing.T) {
	var mu sync.Mutex
	var gotMethod string
	var gotBody map[string]any
	received := make(chan struct{}, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		gotMethod = r.Method
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		mu.Unlock()
		received <- struct{}{}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	e := &Engine{httpClient: http.DefaultClient, allowPrivateHooks: true}
	contact := &store.Contact{
		Email:     "a@b.co",
		FirstName: "Ada",
		LastName:  "Lovelace",
		Company:   "Analytical Engines",
		Position:  "Analyst",
		Tags:      []string{"vip"},
	}
	e.webhookStep(context.Background(), "test-run-id", map[string]any{"url": srv.URL, "method": "post"}, contact)
	select {
	case <-received:
	case <-time.After(5 * time.Second):
		t.Fatal("webhook request never arrived")
	}
	mu.Lock()
	defer mu.Unlock()
	if gotMethod != "POST" {
		t.Fatalf("method = %s, want POST", gotMethod)
	}
	if gotBody["email"] != "a@b.co" || gotBody["firstName"] != "Ada" || gotBody["tags"].([]any)[0] != "vip" {
		t.Fatalf("unexpected payload: %v", gotBody)
	}
}

func TestWebhookStepSkipsWithoutURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("request should not be made")
	}))
	defer srv.Close()
	e := &Engine{httpClient: http.DefaultClient}
	e.webhookStep(context.Background(), "test-run-id", map[string]any{"url": ""}, &store.Contact{Email: "a@b.co"})
	// Malformed URL must not panic or hang.
	e.webhookStep(context.Background(), "test-run-id", map[string]any{"url": "://bad"}, &store.Contact{Email: "a@b.co"})
}
