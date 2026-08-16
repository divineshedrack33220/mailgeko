package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/divineshedrack33220/mailgeko/backend/internal/billing"
)

// Biller is the subset of the billing service the HTTP layer needs.
type Biller interface {
	Current(ctx context.Context, workspaceID string) (billing.Limits, error)
	Checkout(ctx context.Context, workspaceID, plan string) (*billing.CheckoutResult, error)
	Portal(ctx context.Context, workspaceID string) (*billing.PortalResult, error)
	HandleWebhook(ctx context.Context, body []byte, signature string) error
	CheckContactQuota(ctx context.Context, workspaceID string, extra int64) error
	CheckEmailQuota(ctx context.Context, workspaceID string, extra int64) error
}

func (s *Server) handleBillingPlans(w http.ResponseWriter, r *http.Request) {
	writeOK(w, map[string]any{"plans": billing.Plans})
}

func (s *Server) handleBillingCurrent(w http.ResponseWriter, r *http.Request) {
	if s.biller == nil {
		writeError(w, http.StatusServiceUnavailable, "billing_unavailable", "billing is not configured")
		return
	}
	claims := claimsFrom(r)
	limits, err := s.biller.Current(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load billing info")
		return
	}
	writeOK(w, map[string]any{"limits": limits})
}

func (s *Server) handleBillingCheckout(w http.ResponseWriter, r *http.Request) {
	if s.biller == nil {
		writeError(w, http.StatusServiceUnavailable, "billing_unavailable", "billing is not configured")
		return
	}
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	var req struct {
		Plan string `json:"plan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Plan == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "plan is required")
		return
	}
	claims := claimsFrom(r)
	res, err := s.biller.Checkout(r.Context(), claims.GetWorkspaceID(), req.Plan)
	if err != nil {
		if errors.Is(err, billing.ErrUnknownPlan) {
			writeError(w, http.StatusBadRequest, "invalid_request", "unknown plan")
			return
		}
		if errors.Is(err, billing.ErrActiveSubscription) {
			writeError(w, http.StatusConflict, "already_subscribed", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not create checkout")
		return
	}
	writeOK(w, map[string]any{"url": res.URL, "plan": req.Plan})
}

func (s *Server) handleBillingPortal(w http.ResponseWriter, r *http.Request) {
	if s.biller == nil {
		writeError(w, http.StatusServiceUnavailable, "billing_unavailable", "billing is not configured")
		return
	}
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	claims := claimsFrom(r)
	res, err := s.biller.Portal(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create portal session")
		return
	}
	writeOK(w, map[string]any{"url": res.URL})
}

func (s *Server) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	if s.biller == nil {
		writeError(w, http.StatusServiceUnavailable, "billing_unavailable", "billing is not configured")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "could not read body")
		return
	}
	if err := s.biller.HandleWebhook(r.Context(), body, r.Header.Get("stripe-signature")); err != nil {
		if errors.Is(err, billing.ErrInvalidSignature) {
			writeError(w, http.StatusBadRequest, "invalid_signature", "webhook signature verification failed")
			return
		}
		log.Printf("stripe webhook error: %v", err)
		writeError(w, http.StatusBadRequest, "invalid_request", "webhook processing failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"received": true})
}

// writePlanError maps a billing quota error to an HTTP response. Non-quota
// errors are returned as 500.
func (s *Server) writePlanError(w http.ResponseWriter, err error) {
	var le *billing.LimitError
	if errors.As(err, &le) {
		writeJSON(w, http.StatusPaymentRequired, map[string]any{
			"error": le.Code, "message": le.Message,
			"usage": le.Usage, "max": le.Max,
		})
		return
	}
	writeError(w, http.StatusInternalServerError, "internal", "could not check plan limits")
}
