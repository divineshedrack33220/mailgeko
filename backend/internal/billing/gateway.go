package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidSignature = errors.New("invalid webhook signature")

// Event types normalized from gateway webhooks.
const (
	EventCheckoutCompleted   = "checkout.completed"
	EventSubscriptionUpdated = "subscription.updated"
	EventSubscriptionDeleted = "subscription.deleted"
)

// GatewayEvent is a provider-agnostic subscription event.
type GatewayEvent struct {
	Type           string `json:"type"`
	CustomerID     string `json:"customer_id"`
	SubscriptionID string `json:"subscription_id"`
	Plan           string `json:"plan"`
	Status         string `json:"status"`
}

type CheckoutResult struct {
	URL   string
	Event *GatewayEvent // set when checkout completed synchronously (local mode)
}

type PortalResult struct {
	URL string
}

// Gateway is the payment-provider abstraction. The Stripe implementation talks
// to the Stripe REST API; the Local implementation is used for offline dev and
// smoke tests and completes checkouts immediately.
type Gateway interface {
	EnsureCustomer(ctx context.Context, workspaceID, email string) (string, error)
	Checkout(ctx context.Context, customerID, plan, successURL, cancelURL string) (*CheckoutResult, error)
	Portal(ctx context.Context, customerID, returnURL string) (*PortalResult, error)
	HandleWebhook(ctx context.Context, body []byte, signature string) (*GatewayEvent, error)
}

// SignWebhook signs a payload in Stripe's format (t=<ts>,v1=<hmac>).
func SignWebhook(secret string, body []byte) string {
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.%s", ts, body)))
	return fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil)))
}

// VerifyWebhook validates a Stripe-format signature over the body.
func VerifyWebhook(secret string, body []byte, signature string) bool {
	for _, part := range strings.Split(signature, ",") {
		part = strings.TrimSpace(part)
		if !strings.HasPrefix(part, "v1=") {
			continue
		}
		got, err := hex.DecodeString(strings.TrimPrefix(part, "v1="))
		if err != nil {
			return false
		}
		mac := hmac.New(sha256.New, []byte(secret))
		if ts, err := timestampFrom(signature); err == nil {
			mac.Write([]byte(fmt.Sprintf("%d.%s", ts, body)))
		} else {
			mac.Write(body)
		}
		return hmac.Equal(got, mac.Sum(nil))
	}
	return false
}

func timestampFrom(signature string) (int64, error) {
	for _, part := range strings.Split(signature, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "t=") {
			return strconv.ParseInt(strings.TrimPrefix(part, "t="), 10, 64)
		}
	}
	return 0, errors.New("no timestamp")
}
