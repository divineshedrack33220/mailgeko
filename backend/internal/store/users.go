package store

import (
	"context"
	"time"
)

type User struct {
	ID            string    `db:"id"`
	Email         string    `db:"email"`
	PasswordHash  string    `db:"password_hash"`
	Name          string    `db:"name"`
	Role          string    `db:"role"`
	AvatarURL     string    `db:"avatar_url"`
	OAuthProvider string    `db:"oauth_provider"`
	OAuthUID      string    `db:"oauth_uid"`
	TOTPSecret    string     `db:"totp_secret"`
	TOTPEnabled   bool       `db:"totp_enabled"`
	TOTPRecovery  string     `db:"totp_recovery_codes"`
	EmailVerifiedAt *time.Time `db:"email_verified_at"`
	CreatedAt     time.Time  `db:"created_at"`
}

type Workspace struct {
	ID                       string     `db:"id"`
	Name                     string     `db:"name"`
	Plan                     string     `db:"plan"`
	StripeCustomerID         string     `db:"stripe_customer_id"`
	StripeSubscriptionID     string     `db:"stripe_subscription_id"`
	StripeSubscriptionStatus string     `db:"stripe_subscription_status"`
	SubscriptionPeriodEnd    *time.Time `db:"subscription_period_end"`
	FromName                 string     `db:"from_name"`
	FromEmail                string     `db:"from_email"`
	ReplyTo                  string     `db:"reply_to"`
	LogoURL                  string     `db:"logo_url"`
	BrandVoice               string     `db:"brand_voice"`
	CreatedAt                time.Time  `db:"created_at"`
}

func (s *Store) CreateUser(ctx context.Context, u *User) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO users (id, email, password_hash, name, role, avatar_url, oauth_provider, oauth_uid)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.PasswordHash, u.Name, u.Role, nullIfEmpty(u.AvatarURL), nullIfEmpty(u.OAuthProvider), nullIfEmpty(u.OAuthUID))
	return err
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := s.db.GetContext(ctx, &u,
		`SELECT id, email, password_hash, name, role,
		        COALESCE(avatar_url, '') AS avatar_url,
		        COALESCE(oauth_provider, '') AS oauth_provider,
		        COALESCE(oauth_uid, '') AS oauth_uid,
		        COALESCE(totp_secret, '') AS totp_secret,
		        COALESCE(totp_enabled, 0) AS totp_enabled,
		        COALESCE(totp_recovery_codes, '') AS totp_recovery_codes,
		        email_verified_at,
		        created_at
		 FROM users WHERE email = ?`, email)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) UserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := s.db.GetContext(ctx, &u,
		`SELECT id, email, password_hash, name, role,
		        COALESCE(avatar_url, '') AS avatar_url,
		        COALESCE(oauth_provider, '') AS oauth_provider,
		        COALESCE(oauth_uid, '') AS oauth_uid,
		        COALESCE(totp_secret, '') AS totp_secret,
		        COALESCE(totp_enabled, 0) AS totp_enabled,
		        COALESCE(totp_recovery_codes, '') AS totp_recovery_codes,
		        email_verified_at,
		        created_at
		 FROM users WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) UpdateUserAvatar(ctx context.Context, userID, avatarURL string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET avatar_url = ? WHERE id = ?`, nullIfEmpty(avatarURL), userID)
	return err
}

// MarkEmailVerified records when a user confirmed ownership of their email
// address. It is idempotent.
func (s *Store) MarkEmailVerified(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?`, userID)
	return err
}

// SetPasswordHash replaces a user's password hash, used when resetting a
// forgotten password.
func (s *Store) SetPasswordHash(ctx context.Context, userID, passwordHash string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, userID)
	return err
}

// UpdateUserOAuth links a user to an OAuth identity (provider + provider uid).
func (s *Store) UpdateUserOAuth(ctx context.Context, userID, provider, providerUID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users
		 SET oauth_provider = COALESCE(?, oauth_provider),
		     oauth_uid = COALESCE(?, oauth_uid)
		 WHERE id = ?`,
		nullIfEmpty(provider), nullIfEmpty(providerUID), userID)
	return err
}

// SaveTOTPSecret stores a pending (not yet enabled) TOTP secret.
func (s *Store) SaveTOTPSecret(ctx context.Context, userID, secret string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET totp_secret = ?, totp_enabled = 0, totp_recovery_codes = NULL WHERE id = ?`,
		secret, userID)
	return err
}

// EnableTOTP marks a user's TOTP as active and stores hashed recovery codes.
func (s *Store) EnableTOTP(ctx context.Context, userID, secret, recoveryCodesJSON string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET totp_secret = ?, totp_enabled = 1, totp_recovery_codes = ? WHERE id = ?`,
		secret, recoveryCodesJSON, userID)
	return err
}

// DisableTOTP turns two-factor auth off and clears the stored secret and codes.
func (s *Store) DisableTOTP(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_recovery_codes = NULL WHERE id = ?`,
		userID)
	return err
}

// UpdateRecoveryCodes replaces a user's hashed recovery codes.
func (s *Store) UpdateRecoveryCodes(ctx context.Context, userID, recoveryCodesJSON string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET totp_recovery_codes = ? WHERE id = ?`,
		recoveryCodesJSON, userID)
	return err
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
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

// WorkspaceMembership is a workspace a user belongs to, plus their role in it.
type WorkspaceMembership struct {
	ID      string `db:"id"`
	Name    string `db:"name"`
	LogoURL string `db:"logo_url"`
	Role    string `db:"role"`
}

func (s *Store) ListWorkspacesForUser(ctx context.Context, userID string) ([]WorkspaceMembership, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT w.id, w.name, COALESCE(w.logo_url, '') AS logo_url, wm.role
		FROM workspace_members wm
		JOIN workspaces w ON w.id = wm.workspace_id
		WHERE wm.user_id = ?
		ORDER BY wm.role = 'owner' DESC, w.created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []WorkspaceMembership
	for rows.Next() {
		var m WorkspaceMembership
		if err := rows.Scan(&m.ID, &m.Name, &m.LogoURL, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) GetWorkspace(ctx context.Context, workspaceID string) (*Workspace, error) {
	var w Workspace
	err := s.db.GetContext(ctx, &w,
		`SELECT id, name, plan,
		        COALESCE(stripe_customer_id, '') AS stripe_customer_id,
		        COALESCE(stripe_subscription_id, '') AS stripe_subscription_id,
		        COALESCE(stripe_subscription_status, '') AS stripe_subscription_status,
		        subscription_period_end,
		        COALESCE(from_name, '') AS from_name,
		        COALESCE(from_email, '') AS from_email,
		        COALESCE(reply_to, '') AS reply_to,
		        COALESCE(logo_url, '') AS logo_url,
		        COALESCE(brand_voice, '') AS brand_voice,
		        created_at
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

func (s *Store) UpdateWorkspaceSending(ctx context.Context, workspaceID, fromName, fromEmail, replyTo string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE workspaces SET from_name = ?, from_email = ?, reply_to = ? WHERE id = ?`,
		fromName, fromEmail, replyTo, workspaceID)
	return err
}

func (s *Store) UpdateWorkspaceLogo(ctx context.Context, workspaceID, logoURL string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE workspaces SET logo_url = ? WHERE id = ?`, nullIfEmpty(logoURL), workspaceID)
	return err
}

func (s *Store) UpdateWorkspaceBrandVoice(ctx context.Context, workspaceID, brandVoice string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE workspaces SET brand_voice = ? WHERE id = ?`, nullIfEmpty(brandVoice), workspaceID)
	return err
}

func (s *Store) WorkspaceByStripeCustomer(ctx context.Context, customerID string) (*Workspace, error) {
	var w Workspace
	err := s.db.GetContext(ctx, &w,
		`SELECT id, name, plan,
		        COALESCE(stripe_customer_id, '') AS stripe_customer_id,
		        COALESCE(stripe_subscription_id, '') AS stripe_subscription_id,
		        COALESCE(stripe_subscription_status, '') AS stripe_subscription_status,
		        subscription_period_end,
		        COALESCE(from_name, '') AS from_name,
		        COALESCE(from_email, '') AS from_email,
		        COALESCE(reply_to, '') AS reply_to,
		        COALESCE(logo_url, '') AS logo_url,
		        COALESCE(brand_voice, '') AS brand_voice,
		        created_at
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
