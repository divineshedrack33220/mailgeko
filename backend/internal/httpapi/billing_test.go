package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/billing"
)

type fakeBill struct {
	limits   billing.Limits
	quotaErr error
}

func (f *fakeBill) Current(ctx context.Context, wsID string) (billing.Limits, error) {
	return f.limits, nil
}
func (f *fakeBill) Checkout(ctx context.Context, wsID, plan string) (*billing.CheckoutResult, error) {
	return &billing.CheckoutResult{URL: "http://checkout.test/" + plan}, nil
}
func (f *fakeBill) Portal(ctx context.Context, wsID string) (*billing.PortalResult, error) {
	return &billing.PortalResult{URL: "http://portal.test"}, nil
}
func (f *fakeBill) HandleWebhook(ctx context.Context, body []byte, signature string) error {
	if signature == "bad" {
		return billing.ErrInvalidSignature
	}
	return nil
}
func (f *fakeBill) CheckContactQuota(ctx context.Context, wsID string, extra int64) error {
	return f.quotaErr
}
func (f *fakeBill) CheckEmailQuota(ctx context.Context, wsID string, extra int64) error {
	return f.quotaErr
}

func newBillingTestServer(t *testing.T, biller Biller) *httptest.Server {
	t.Helper()
	mgr := auth.NewTokenManager("test-secret", time.Hour)
	srv := New(Config{}, nil, nil, mgr, nil, nil, nil, nil, biller, nil)
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts
}

func billingToken(t *testing.T) string {
	t.Helper()
	mgr := auth.NewTokenManager("test-secret", time.Hour)
	tok, err := mgr.Issue("u-1", "u@example.com", "ws-1", "owner")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestBillingPlans(t *testing.T) {
	ts := newBillingTestServer(t, nil)
	token := billingToken(t)
	resp, err := ts.Client().Do(mustGet(ts.URL+"/api/v1/billing/plans", token))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if n := len(body["plans"].([]any)); n != 3 {
		t.Fatalf("expected 3 plans, got %d", n)
	}
}

func TestBillingCurrentCheckoutPortal(t *testing.T) {
	fake := &fakeBill{limits: billing.Limits{Plan: "growth", PlanName: "Growth", MaxContacts: 10000, MaxEmailsPerMonth: 50000}}
	ts := newBillingTestServer(t, fake)
	token := billingToken(t)

	resp, _ := ts.Client().Do(mustGet(ts.URL+"/api/v1/billing", token))
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	limits := body["limits"].(map[string]any)
	if limits["plan"] != "growth" {
		t.Fatalf("unexpected limits: %v", limits)
	}
	resp.Body.Close()

	resp, _ = ts.Client().Do(mustPost(ts.URL+"/api/v1/billing/checkout", token, `{"plan":"growth"}`))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("checkout status %d", resp.StatusCode)
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body["url"] != "http://checkout.test/growth" {
		t.Fatalf("unexpected checkout url: %v", body)
	}
	resp.Body.Close()

	resp, _ = ts.Client().Do(mustPost(ts.URL+"/api/v1/billing/checkout", token, `{}`))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty plan, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	resp, _ = ts.Client().Do(mustPost(ts.URL+"/api/v1/billing/portal", token, `{}`))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("portal status %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestBillingWebhook(t *testing.T) {
	fake := &fakeBill{}
	ts := newBillingTestServer(t, fake)

	resp, err := ts.Client().Post(ts.URL+"/webhooks/stripe", "application/json", bytes.NewBufferString(`{"type":"x"}`))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("webhook status %d", resp.StatusCode)
	}

	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/webhooks/stripe", bytes.NewBufferString(`{"type":"x"}`))
	req.Header.Set("stripe-signature", "bad")
	resp, err = ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad signature, got %d", resp.StatusCode)
	}
}

func TestBillingUnavailable(t *testing.T) {
	ts := newBillingTestServer(t, nil)
	token := billingToken(t)
	resp, err := ts.Client().Do(mustGet(ts.URL+"/api/v1/billing", token))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.StatusCode)
	}
}

func TestContactQuotaRejected(t *testing.T) {
	fake := &fakeBill{quotaErr: &billing.LimitError{Code: "contact_limit", Message: "limit reached", Max: 2000}}
	ts := newBillingTestServer(t, fake)
	token := billingToken(t)
	resp, err := ts.Client().Do(mustPost(ts.URL+"/api/v1/contacts", token, `{"email":"a@b.com"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusPaymentRequired {
		t.Fatalf("expected 402, got %d", resp.StatusCode)
	}
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body["error"] != "contact_limit" {
		t.Fatalf("unexpected body: %v", body)
	}
}

func mustGet(url, token string) *http.Request {
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func mustPost(url, token, body string) *http.Request {
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}
