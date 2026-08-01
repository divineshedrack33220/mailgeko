package billing

import (
	"context"
	"database/sql"
	"testing"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func TestPlanCatalog(t *testing.T) {
	if len(Plans) != 3 {
		t.Fatalf("expected 3 plans, got %d", len(Plans))
	}
	if p, ok := PlanByID("growth"); !ok {
		t.Fatal("growth plan missing")
	} else if p.PriceMonthly != 49 || p.MaxContacts != 10000 || p.EmailsPerMonth != 50000 {
		t.Fatalf("unexpected growth plan: %+v", p)
	}
	if _, ok := PlanByID("nope"); ok {
		t.Fatal("unknown plan should not resolve")
	}
	if DefaultPlanID() != "starter" {
		t.Fatal("default plan should be starter")
	}
}

func TestLimitsAtOrOver(t *testing.T) {
	l, err := limitsFor("starter", Usage{Contacts: 1999, EmailsThisMonth: 10000})
	if err != nil {
		t.Fatal(err)
	}
	if l.ContactsExceeded || !l.EmailsExceeded {
		t.Fatalf("expected only emails exceeded: %+v", l)
	}
	if l.MaxContacts != 2000 || l.MaxEmailsPerMonth != 10000 {
		t.Fatalf("unexpected caps: %+v", l)
	}
}

func TestQuotaErrors(t *testing.T) {
	ce := contactLimitError(Usage{Contacts: 2000}, 2000)
	if ce.Code != "contact_limit" || ce.Max != 2000 {
		t.Fatalf("unexpected contact error: %+v", ce)
	}
	ee := emailLimitError(Usage{EmailsThisMonth: 50000}, 50000)
	if ee.Code != "email_limit" {
		t.Fatalf("unexpected email error: %+v", ee)
	}
}

type memStore struct {
	ws       map[string]*store.Workspace
	byCust   map[string]string
	contacts int64
	emails   int64
}

func newMemStore(plan string) *memStore {
	ws := map[string]*store.Workspace{
		"ws-1": {ID: "ws-1", Name: "Test", Plan: plan},
	}
	return &memStore{ws: ws, byCust: map[string]string{}}
}

func (m *memStore) GetWorkspace(ctx context.Context, id string) (*store.Workspace, error) {
	return m.ws[id], nil
}
func (m *memStore) UpdateWorkspaceSubscription(ctx context.Context, wsID, plan, custID, subID, status string) error {
	m.ws[wsID].Plan = plan
	m.ws[wsID].StripeCustomerID = custID
	m.ws[wsID].StripeSubscriptionID = subID
	m.ws[wsID].StripeSubscriptionStatus = status
	m.byCust[custID] = wsID
	return nil
}
func (m *memStore) CountContacts(ctx context.Context, wsID string) (int64, error) {
	return m.contacts, nil
}
func (m *memStore) CountEmailsThisMonth(ctx context.Context, wsID string) (int64, error) {
	return m.emails, nil
}
func (m *memStore) WorkspaceByStripeCustomer(ctx context.Context, customerID string) (*store.Workspace, error) {
	id, ok := m.byCust[customerID]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return m.ws[id], nil
}
