package billing

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestServiceCheckoutLocalAppliesImmediately(t *testing.T) {
	ctx := context.Background()
	store := newMemStore("starter")
	gw := NewLocal("secret", "http://localhost:8080")
	svc := NewService(store, gw, "http://localhost:8080")

	res, err := svc.Checkout(ctx, "ws-1", "growth")
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if res.URL == "" || res.Event == nil {
		t.Fatalf("local checkout should complete synchronously: %+v", res)
	}
	if store.ws["ws-1"].Plan != "growth" {
		t.Fatalf("plan should be applied immediately, got %q", store.ws["ws-1"].Plan)
	}
	if store.ws["ws-1"].StripeCustomerID == "" || store.ws["ws-1"].StripeSubscriptionID == "" {
		t.Fatalf("customer/subscription should be persisted: %+v", store.ws["ws-1"])
	}

	l, err := svc.Current(ctx, "ws-1")
	if err != nil {
		t.Fatal(err)
	}
	if l.Plan != "growth" || l.MaxContacts != 10000 {
		t.Fatalf("current should reflect growth: %+v", l)
	}
}

func TestServiceUnknownPlan(t *testing.T) {
	svc := NewService(newMemStore("starter"), NewLocal("s", "http://x"), "http://x")
	if _, err := svc.Checkout(context.Background(), "ws-1", "nope"); !errors.Is(err, ErrUnknownPlan) {
		t.Fatalf("expected ErrUnknownPlan, got %v", err)
	}
}

func TestServiceWebhookLifecycle(t *testing.T) {
	ctx := context.Background()
	store := newMemStore("starter")
	gw := NewLocal("whsec", "http://localhost:8080")
	svc := NewService(store, gw, "http://localhost:8080")

	// Prime a customer via checkout.
	if _, err := svc.Checkout(ctx, "ws-1", "scale"); err != nil {
		t.Fatal(err)
	}
	customer := store.ws["ws-1"].StripeCustomerID

	// subscription.updated -> past_due
	body, _ := json.Marshal(localWebhookPayload{Type: EventSubscriptionUpdated, CustomerID: customer, Plan: "scale", Status: "past_due"})
	sig := SignWebhook("whsec", body)
	if err := svc.HandleWebhook(ctx, body, sig); err != nil {
		t.Fatalf("webhook updated: %v", err)
	}
	if store.ws["ws-1"].StripeSubscriptionStatus != "past_due" {
		t.Fatalf("status should be past_due: %+v", store.ws["ws-1"])
	}

	// subscription.deleted -> back to starter, canceled
	body, _ = json.Marshal(localWebhookPayload{Type: EventSubscriptionDeleted, CustomerID: customer})
	sig = SignWebhook("whsec", body)
	if err := svc.HandleWebhook(ctx, body, sig); err != nil {
		t.Fatalf("webhook deleted: %v", err)
	}
	if store.ws["ws-1"].Plan != "starter" || store.ws["ws-1"].StripeSubscriptionStatus != "canceled" {
		t.Fatalf("expected downgrade to starter/canceled: %+v", store.ws["ws-1"])
	}

	// Bad signature must be rejected.
	if err := svc.HandleWebhook(ctx, body, "v1=deadbeef"); !errors.Is(err, ErrInvalidSignature) {
		t.Fatalf("expected ErrInvalidSignature, got %v", err)
	}
}

func TestServiceQuota(t *testing.T) {
	ctx := context.Background()
	store := newMemStore("starter")
	store.contacts = 1999
	store.emails = 9990
	svc := NewService(store, NewLocal("s", "http://x"), "http://x")

	if err := svc.CheckContactQuota(ctx, "ws-1", 1); err != nil {
		t.Fatalf("1999+1 reaches the cap exactly and should be allowed: %v", err)
	}
	store.contacts = 1990
	if err := svc.CheckContactQuota(ctx, "ws-1", 1); err != nil {
		t.Fatalf("expected quota ok: %v", err)
	}
	var le *LimitError
	store.contacts = 2001
	if err := svc.CheckContactQuota(ctx, "ws-1", 1); !errors.As(err, &le) || le.Code != "contact_limit" {
		t.Fatalf("expected contact_limit, got %v", err)
	}
	store.emails = 10000
	if err := svc.CheckEmailQuota(ctx, "ws-1", 1); !errors.As(err, &le) || le.Code != "email_limit" {
		t.Fatalf("expected email_limit, got %v", err)
	}
}
