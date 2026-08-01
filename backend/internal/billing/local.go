package billing

import (
	"context"
	"encoding/json"
	"fmt"
)

// Local is an offline payment gateway used for development and smoke tests.
// Checkouts complete immediately (no external call) and the resulting event is
// returned on the CheckoutResult so the service can apply it synchronously.
// Webhooks are accepted when signed with the same shared secret.
type Local struct {
	webhookSecret string
	baseURL       string
}

func NewLocal(webhookSecret, baseURL string) *Local {
	return &Local{webhookSecret: webhookSecret, baseURL: baseURL}
}

func (l *Local) EnsureCustomer(ctx context.Context, workspaceID, email string) (string, error) {
	return "cus_local_" + workspaceID, nil
}

func (l *Local) Checkout(ctx context.Context, customerID, plan, successURL, cancelURL string) (*CheckoutResult, error) {
	return &CheckoutResult{
		URL: successURL,
		Event: &GatewayEvent{
			Type: EventCheckoutCompleted, CustomerID: customerID,
			SubscriptionID: "sub_local_" + customerID, Plan: plan, Status: "active",
		},
	}, nil
}

func (l *Local) Portal(ctx context.Context, customerID, returnURL string) (*PortalResult, error) {
	return &PortalResult{URL: returnURL}, nil
}

type localWebhookPayload struct {
	Type           string `json:"type"`
	CustomerID     string `json:"customer_id"`
	SubscriptionID string `json:"subscription_id"`
	Plan           string `json:"plan"`
	Status         string `json:"status"`
}

func (l *Local) HandleWebhook(ctx context.Context, body []byte, signature string) (*GatewayEvent, error) {
	if !VerifyWebhook(l.webhookSecret, body, signature) {
		return nil, ErrInvalidSignature
	}
	var p localWebhookPayload
	if err := json.Unmarshal(body, &p); err != nil {
		return nil, err
	}
	if p.Type == "" || p.CustomerID == "" {
		return nil, fmt.Errorf("invalid local webhook payload")
	}
	if p.SubscriptionID == "" {
		p.SubscriptionID = "sub_local_" + p.CustomerID
	}
	if p.Status == "" {
		p.Status = "active"
	}
	if p.Plan == "" {
		if p.Type == EventSubscriptionDeleted {
			p.Plan = DefaultPlanID()
		} else {
			p.Plan = Plans[0].ID
		}
	}
	return &GatewayEvent{
		Type: p.Type, CustomerID: p.CustomerID, SubscriptionID: p.SubscriptionID,
		Plan: p.Plan, Status: p.Status,
	}, nil
}
