package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// StripeConfig holds Stripe credentials. Prices maps plan ID -> Stripe price ID.
type StripeConfig struct {
	APIKey        string
	WebhookSecret string
	BaseURL       string // API base, override for testing
	Prices        map[string]string
}

type Stripe struct {
	apiKey        string
	webhookSecret string
	baseURL       string
	prices        map[string]string
	httpClient    *http.Client
}

func NewStripe(cfg StripeConfig) *Stripe {
	base := cfg.BaseURL
	if base == "" {
		base = "https://api.stripe.com/v1"
	}
	return &Stripe{
		apiKey:        cfg.APIKey,
		webhookSecret: cfg.WebhookSecret,
		baseURL:       strings.TrimSuffix(base, "/"),
		prices:        cfg.Prices,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *Stripe) EnsureCustomer(ctx context.Context, workspaceID, email string) (string, error) {
	form := url.Values{}
	form.Set("email", email)
	form.Set("metadata[workspace_id]", workspaceID)
	var out struct {
		ID string `json:"id"`
	}
	if err := s.post(ctx, "/customers", form, &out); err != nil {
		return "", err
	}
	return out.ID, nil
}

func (s *Stripe) Checkout(ctx context.Context, customerID, plan, successURL, cancelURL string) (*CheckoutResult, error) {
	priceID, ok := s.prices[plan]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnknownPlan, plan)
	}
	form := url.Values{}
	form.Set("customer", customerID)
	form.Set("mode", "subscription")
	form.Set("line_items[0][price]", priceID)
	form.Set("line_items[0][quantity]", "1")
	form.Set("success_url", successURL)
	form.Set("cancel_url", cancelURL)
	form.Set("metadata[plan]", plan)
	var out struct {
		URL string `json:"url"`
	}
	if err := s.post(ctx, "/checkout/sessions", form, &out); err != nil {
		return nil, err
	}
	return &CheckoutResult{URL: out.URL}, nil
}

func (s *Stripe) Portal(ctx context.Context, customerID, returnURL string) (*PortalResult, error) {
	form := url.Values{}
	form.Set("customer", customerID)
	form.Set("return_url", returnURL)
	var out struct {
		URL string `json:"url"`
	}
	if err := s.post(ctx, "/billing_portal/sessions", form, &out); err != nil {
		return nil, err
	}
	return &PortalResult{URL: out.URL}, nil
}

func (s *Stripe) HandleWebhook(ctx context.Context, body []byte, signature string) (*GatewayEvent, error) {
	if !VerifyWebhook(s.webhookSecret, body, signature) {
		return nil, ErrInvalidSignature
	}
	var evt struct {
		Type string `json:"type"`
		Data struct {
			Object json.RawMessage `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &evt); err != nil {
		return nil, err
	}
	switch evt.Type {
	case "checkout.session.completed":
		var o struct {
			Customer     string `json:"customer"`
			Subscription string `json:"subscription"`
			Metadata     struct {
				Plan string `json:"plan"`
			} `json:"metadata"`
		}
		if err := json.Unmarshal(evt.Data.Object, &o); err != nil {
			return nil, err
		}
		return &GatewayEvent{
			Type: EventCheckoutCompleted, CustomerID: o.Customer,
			SubscriptionID: o.Subscription, Plan: o.Metadata.Plan, Status: "active",
		}, nil
	case "customer.subscription.updated", "customer.subscription.deleted":
		var o struct {
			ID       string `json:"id"`
			Customer string `json:"customer"`
			Status   string `json:"status"`
			Items    struct {
				Data []struct {
					Price struct {
						ID string `json:"id"`
					} `json:"price"`
				} `json:"data"`
			} `json:"items"`
		}
		if err := json.Unmarshal(evt.Data.Object, &o); err != nil {
			return nil, err
		}
		plan := s.planForPrice(o.Items.Data)
		if o.Status == "canceled" {
			plan = DefaultPlanID()
		}
		t := EventSubscriptionUpdated
		if evt.Type == "customer.subscription.deleted" {
			t = EventSubscriptionDeleted
		}
		return &GatewayEvent{
			Type: t, CustomerID: o.Customer, SubscriptionID: o.ID,
			Plan: plan, Status: o.Status,
		}, nil
	}
	return nil, errors.New("unhandled webhook event: " + evt.Type)
}

func (s *Stripe) planForPrice(items []struct {
	Price struct {
		ID string `json:"id"`
	} `json:"price"`
}) string {
	for _, it := range items {
		for plan, priceID := range s.prices {
			if priceID == it.Price.ID {
				return plan
			}
		}
	}
	return DefaultPlanID()
}

func (s *Stripe) post(ctx context.Context, path string, form url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+path, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("stripe %s: status %d: %s", path, resp.StatusCode, truncate(string(body), 200))
	}
	return json.Unmarshal(body, out)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
