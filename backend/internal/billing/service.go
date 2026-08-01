package billing

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

// Store is the persistence the billing service needs.
type Store interface {
	GetWorkspace(ctx context.Context, workspaceID string) (*store.Workspace, error)
	UpdateWorkspaceSubscription(ctx context.Context, workspaceID, plan, customerID, subscriptionID, status string) error
	CountContacts(ctx context.Context, workspaceID string) (int64, error)
	CountEmailsThisMonth(ctx context.Context, workspaceID string) (int64, error)
	WorkspaceByStripeCustomer(ctx context.Context, customerID string) (*store.Workspace, error)
}

type Service struct {
	db       Store
	gateway  Gateway
	baseURL  string
	success  string
	cancel   string
	portalRT string
}

func NewService(db Store, gateway Gateway, baseURL string) *Service {
	return &Service{
		db: db, gateway: gateway, baseURL: baseURL,
		success:  baseURL + "/settings/billing?checkout=success",
		cancel:   baseURL + "/settings/billing?checkout=cancelled",
		portalRT: baseURL + "/settings/billing",
	}
}

// Current returns plan limits and current usage for a workspace.
func (s *Service) Current(ctx context.Context, workspaceID string) (Limits, error) {
	ws, err := s.db.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return Limits{}, err
	}
	return s.currentFor(ctx, ws)
}

func (s *Service) currentFor(ctx context.Context, ws *store.Workspace) (Limits, error) {
	contacts, err := s.db.CountContacts(ctx, ws.ID)
	if err != nil {
		return Limits{}, err
	}
	emails, err := s.db.CountEmailsThisMonth(ctx, ws.ID)
	if err != nil {
		return Limits{}, err
	}
	return limitsFor(ws.Plan, Usage{Contacts: contacts, EmailsThisMonth: emails})
}

// CheckContactQuota returns a LimitError when adding extra contacts would exceed the plan cap.
func (s *Service) CheckContactQuota(ctx context.Context, workspaceID string, extra int64) error {
	ws, err := s.db.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return err
	}
	usage := Usage{Contacts: 0}
	usage.Contacts, err = s.db.CountContacts(ctx, workspaceID)
	if err != nil {
		return err
	}
	p, _ := PlanByID(ws.Plan)
	max := int64(p.MaxContacts)
	if usage.Contacts+extra > max {
		return contactLimitError(usage, max)
	}
	return nil
}

// CheckEmailQuota returns a LimitError when sending extra emails would exceed the monthly cap.
func (s *Service) CheckEmailQuota(ctx context.Context, workspaceID string, extra int64) error {
	ws, err := s.db.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return err
	}
	usage := Usage{}
	usage.EmailsThisMonth, err = s.db.CountEmailsThisMonth(ctx, workspaceID)
	if err != nil {
		return err
	}
	p, _ := PlanByID(ws.Plan)
	max := int64(p.EmailsPerMonth)
	if usage.EmailsThisMonth+extra > max {
		return emailLimitError(usage, max)
	}
	return nil
}

// Checkout starts a subscription checkout for a plan. In local mode the plan is
// applied immediately and the returned CheckoutResult carries the event.
func (s *Service) Checkout(ctx context.Context, workspaceID, plan string) (*CheckoutResult, error) {
	if _, ok := PlanByID(plan); !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnknownPlan, plan)
	}
	ws, err := s.db.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	customerID := ws.StripeCustomerID
	if customerID == "" {
		customerID, err = s.gateway.EnsureCustomer(ctx, ws.ID, "")
		if err != nil {
			return nil, err
		}
		_ = s.db.UpdateWorkspaceSubscription(ctx, ws.ID, ws.Plan, customerID, ws.StripeSubscriptionID, ws.StripeSubscriptionStatus)
	}
	res, err := s.gateway.Checkout(ctx, customerID, plan, s.success, s.cancel)
	if err != nil {
		return nil, err
	}
	if res.Event != nil {
		_ = s.applyEvent(ctx, ws.ID, res.Event)
	}
	return res, nil
}

// Portal returns a billing portal URL.
func (s *Service) Portal(ctx context.Context, workspaceID string) (*PortalResult, error) {
	ws, err := s.db.GetWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	customerID := ws.StripeCustomerID
	if customerID == "" {
		customerID, err = s.gateway.EnsureCustomer(ctx, ws.ID, "")
		if err != nil {
			return nil, err
		}
		_ = s.db.UpdateWorkspaceSubscription(ctx, ws.ID, ws.Plan, customerID, ws.StripeSubscriptionID, ws.StripeSubscriptionStatus)
	}
	return s.gateway.Portal(ctx, customerID, s.portalRT)
}

// HandleWebhook validates a gateway webhook and applies it to the workspace.
func (s *Service) HandleWebhook(ctx context.Context, body []byte, signature string) error {
	evt, err := s.gateway.HandleWebhook(ctx, body, signature)
	if err != nil {
		return err
	}
	ws, err := s.db.WorkspaceByStripeCustomer(ctx, evt.CustomerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("no workspace for stripe customer")
		}
		return err
	}
	return s.applyEvent(ctx, ws.ID, evt)
}

func (s *Service) applyEvent(ctx context.Context, workspaceID string, evt *GatewayEvent) error {
	if _, ok := PlanByID(evt.Plan); !ok {
		evt.Plan = DefaultPlanID()
	}
	switch evt.Type {
	case EventCheckoutCompleted, EventSubscriptionUpdated:
		return s.db.UpdateWorkspaceSubscription(ctx, workspaceID, evt.Plan, evt.CustomerID, evt.SubscriptionID, evt.Status)
	case EventSubscriptionDeleted:
		return s.db.UpdateWorkspaceSubscription(ctx, workspaceID, DefaultPlanID(), evt.CustomerID, evt.SubscriptionID, "canceled")
	default:
		return errors.New("unhandled billing event: " + evt.Type)
	}
}
