package store

import (
	"context"
	"time"
)

type User struct {
	ID           string    `db:"id"`
	Email        string    `db:"email"`
	PasswordHash string    `db:"password_hash"`
	Name         string    `db:"name"`
	Role         string    `db:"role"`
	CreatedAt    time.Time `db:"created_at"`
}

type Workspace struct {
	ID                       string     `db:"id"`
	Name                     string     `db:"name"`
	Plan                     string     `db:"plan"`
	StripeCustomerID         string     `db:"stripe_customer_id"`
	StripeSubscriptionID     string     `db:"stripe_subscription_id"`
	StripeSubscriptionStatus string     `db:"stripe_subscription_status"`
	SubscriptionPeriodEnd    *time.Time `db:"subscription_period_end"`
	CreatedAt                time.Time  `db:"created_at"`
}

func (s *Store) CreateUser(ctx context.Context, u *User) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.PasswordHash, u.Name, u.Role)
	return err
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := s.db.GetContext(ctx, &u,
		`SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = ?`, email)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) UserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := s.db.GetContext(ctx, &u,
		`SELECT id, email, password_hash, name, role, created_at FROM users WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) CreateWorkspace(ctx context.Context, w *Workspace) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO workspaces (id, name) VALUES (?, ?)`, w.ID, w.Name)
	return err
}

func (s *Store) AddWorkspaceMember(ctx context.Context, workspaceID, userID, role string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)`,
		workspaceID, userID, role)
	return err
}

func (s *Store) WorkspaceIDForUser(ctx context.Context, userID string) (string, error) {
	var workspaceID string
	err := s.db.GetContext(ctx, &workspaceID,
		`SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY created_at LIMIT 1`, userID)
	return workspaceID, err
}

func (s *Store) GetWorkspace(ctx context.Context, workspaceID string) (*Workspace, error) {
	var w Workspace
	err := s.db.GetContext(ctx, &w,
		`SELECT id, name, plan,
		        COALESCE(stripe_customer_id, '') AS stripe_customer_id,
		        COALESCE(stripe_subscription_id, '') AS stripe_subscription_id,
		        COALESCE(stripe_subscription_status, '') AS stripe_subscription_status,
		        subscription_period_end, created_at
		 FROM workspaces WHERE id = ?`, workspaceID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *Store) UpdateWorkspaceName(ctx context.Context, workspaceID, name string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE workspaces SET name = ? WHERE id = ?`, name, workspaceID)
	return err
}

func (s *Store) WorkspaceByStripeCustomer(ctx context.Context, customerID string) (*Workspace, error) {
	var w Workspace
	err := s.db.GetContext(ctx, &w,
		`SELECT id, name, plan,
		        COALESCE(stripe_customer_id, '') AS stripe_customer_id,
		        COALESCE(stripe_subscription_id, '') AS stripe_subscription_id,
		        COALESCE(stripe_subscription_status, '') AS stripe_subscription_status,
		        subscription_period_end, created_at
		 FROM workspaces WHERE stripe_customer_id = ?`, customerID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *Store) UpdateWorkspaceSubscription(ctx context.Context, workspaceID, plan, customerID, subscriptionID, status string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE workspaces
		 SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id),
		     stripe_subscription_id = ?, stripe_subscription_status = ?
		 WHERE id = ?`,
		plan, customerID, subscriptionID, status, workspaceID)
	return err
}

func (s *Store) CountEmailsThisMonth(ctx context.Context, workspaceID string) (int64, error) {
	var n int64
	start := time.Now().UTC().Truncate(time.Hour)
	start = time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
	err := s.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM campaign_recipients r
		 JOIN campaigns c ON c.id = r.campaign_id
		 WHERE c.workspace_id = ? AND r.sent_at IS NOT NULL AND r.sent_at >= ?`,
		workspaceID, start)
	return n, err
}
