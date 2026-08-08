package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

type Member struct {
	ID         string `db:"id"`
	Name       string `db:"name"`
	Email      string `db:"email"`
	Role       string `db:"role"`
	Status     string `db:"status"`
	InvitedAt  *time.Time
	LastActive *time.Time
}

type Invitation struct {
	ID          string          `db:"id"`
	WorkspaceID string          `db:"workspace_id"`
	Email       string          `db:"email"`
	Role        string          `db:"role"`
	Status      string          `db:"status"`
	TokenHash   sql.NullString  `db:"token_hash"`
	ExpiresAt   sql.NullTime    `db:"expires_at"`
	CreatedAt   time.Time       `db:"created_at"`
}

type APIKey struct {
	ID          string     `db:"id"`
	WorkspaceID string     `db:"workspace_id"`
	Name        string     `db:"name"`
	Prefix      string     `db:"prefix"`
	KeyHash     string     `db:"key_hash"`
	Scopes      []string   `db:"-"`
	LastUsedAt  *time.Time `db:"last_used_at"`
	CreatedAt   time.Time  `db:"created_at"`
}

func (s *Store) ListWorkspaceMembers(ctx context.Context, workspaceID string) ([]Member, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT u.id, u.name, u.email, wm.role, 'active' AS status,
		       NULL AS invited_at, u.created_at AS last_active
		FROM workspace_members wm
		JOIN users u ON u.id = wm.user_id
		WHERE wm.workspace_id = ?
		ORDER BY wm.role = 'owner' DESC, u.created_at ASC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		var invitedAt sql.NullTime
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.Status, &invitedAt, &m.LastActive); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

func (s *Store) ListInvitations(ctx context.Context, workspaceID string) ([]Invitation, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, workspace_id, email, role, status, token_hash, expires_at, created_at
		FROM invitations
		WHERE workspace_id = ? AND status = 'pending'
		ORDER BY created_at ASC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Invitation
	for rows.Next() {
		var inv Invitation
		if err := rows.Scan(&inv.ID, &inv.WorkspaceID, &inv.Email, &inv.Role, &inv.Status, &inv.TokenHash, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (s *Store) CreateInvitation(ctx context.Context, inv *Invitation) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO invitations (id, workspace_id, email, role, status, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		inv.ID, inv.WorkspaceID, inv.Email, inv.Role, inv.Status, inv.TokenHash, inv.ExpiresAt)
	return err
}

func (s *Store) InvitationByEmail(ctx context.Context, workspaceID, email string) (*Invitation, error) {
	var inv Invitation
	err := s.db.GetContext(ctx, &inv,
		`SELECT id, workspace_id, email, role, status, token_hash, expires_at, created_at
		 FROM invitations WHERE workspace_id = ? AND email = ?`, workspaceID, email)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *Store) InvitationByTokenHash(ctx context.Context, tokenHash string) (*Invitation, error) {
	var inv Invitation
	err := s.db.GetContext(ctx, &inv,
		`SELECT id, workspace_id, email, role, status, token_hash, expires_at, created_at
		 FROM invitations WHERE token_hash = ? AND status = 'pending'`, tokenHash)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *Store) UpdateInvitationRole(ctx context.Context, workspaceID, id, role string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE invitations SET role = ? WHERE workspace_id = ? AND id = ?`,
		role, workspaceID, id)
	return err
}

func (s *Store) UpdateInvitationToken(ctx context.Context, workspaceID, id, tokenHash string, expiresAt sql.NullTime) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE invitations SET token_hash = ?, expires_at = ? WHERE workspace_id = ? AND id = ?`,
		tokenHash, expiresAt, workspaceID, id)
	return err
}

func (s *Store) DeleteInvitation(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM invitations WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}

func (s *Store) UpdateMemberRole(ctx context.Context, workspaceID, userID, role string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?`,
		role, workspaceID, userID)
	return err
}

func (s *Store) WorkspaceMemberByUserID(ctx context.Context, workspaceID, userID string) (string, error) {
	var role string
	err := s.db.GetContext(ctx, &role,
		`SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`, workspaceID, userID)
	return role, err
}

func (s *Store) WorkspaceMemberByEmail(ctx context.Context, workspaceID, email string) (string, error) {
	var role string
	err := s.db.GetContext(ctx, &role,
		`SELECT wm.role FROM workspace_members wm
		 JOIN users u ON u.id = wm.user_id
		 WHERE wm.workspace_id = ? AND u.email = ?`, workspaceID, email)
	return role, err
}

func (s *Store) InvitationByID(ctx context.Context, workspaceID, id string) (*Invitation, error) {
	var inv Invitation
	err := s.db.GetContext(ctx, &inv,
		`SELECT id, workspace_id, email, role, status, created_at
		 FROM invitations WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *Store) DeleteWorkspaceMember(ctx context.Context, workspaceID, userID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`, workspaceID, userID)
	return err
}

func (s *Store) ListAPIKeys(ctx context.Context, workspaceID string) ([]APIKey, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, workspace_id, name, prefix, key_hash, scopes, last_used_at, created_at
		FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var k APIKey
		var scopes sql.NullString
		var lastUsed sql.NullTime
		if err := rows.Scan(&k.ID, &k.WorkspaceID, &k.Name, &k.Prefix, &k.KeyHash, &scopes, &lastUsed, &k.CreatedAt); err != nil {
			return nil, err
		}
		if scopes.Valid {
			_ = json.Unmarshal([]byte(scopes.String), &k.Scopes)
		}
		if lastUsed.Valid {
			k.LastUsedAt = &lastUsed.Time
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (s *Store) CreateAPIKey(ctx context.Context, k *APIKey) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO api_keys (id, workspace_id, name, prefix, key_hash, scopes)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		k.ID, k.WorkspaceID, k.Name, k.Prefix, k.KeyHash, marshalJSON(k.Scopes))
	return err
}

func (s *Store) DeleteAPIKey(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM api_keys WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}

// GetAPIKeyByHash returns an API key matching the given SHA-256 hash, or nil
// when no key matches.
func (s *Store) GetAPIKeyByHash(ctx context.Context, keyHash string) (*APIKey, error) {
	var k APIKey
	var scopes sql.NullString
	var lastUsed sql.NullTime
	err := s.db.QueryRowContext(ctx,
		`SELECT id, workspace_id, name, prefix, key_hash, scopes, last_used_at, created_at
		 FROM api_keys WHERE key_hash = ?`, keyHash).
		Scan(&k.ID, &k.WorkspaceID, &k.Name, &k.Prefix, &k.KeyHash, &scopes, &lastUsed, &k.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if scopes.Valid {
		_ = json.Unmarshal([]byte(scopes.String), &k.Scopes)
	}
	if lastUsed.Valid {
		k.LastUsedAt = &lastUsed.Time
	}
	return &k, nil
}

// TouchAPIKeyLastUsed updates the last_used_at column without failing the
// request if the update errors (best-effort bookkeeping).
func (s *Store) TouchAPIKeyLastUsed(ctx context.Context, id string) {
	_, _ = s.db.ExecContext(ctx,
		`UPDATE api_keys SET last_used_at = NOW() WHERE id = ?`, id)
}

func (s *Store) NotificationPrefs(ctx context.Context, userID string) (map[string]string, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT pref_key, value FROM notification_prefs WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	prefs := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		prefs[key] = value
	}
	return prefs, rows.Err()
}

func (s *Store) UpsertNotificationPref(ctx context.Context, userID, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO notification_prefs (user_id, pref_key, value) VALUES (?, ?, ?)
		 ON DUPLICATE KEY UPDATE value = VALUES(value)`,
		userID, key, value)
	return err
}

func (s *Store) UpdateUserPassword(ctx context.Context, userID, passwordHash string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, userID)
	return err
}

func (s *Store) UpdateUserName(ctx context.Context, userID, name string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE users SET name = ? WHERE id = ?`, name, userID)
	return err
}
