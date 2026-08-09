package store

import (
	"context"
	"time"
)

// WorkspaceSMTP is a workspace's bring-your-own-SMTP configuration. The
// password is stored encrypted (see internal/crypto) as PasswordCipher.
type WorkspaceSMTP struct {
	WorkspaceID    string    `db:"workspace_id"`
	Host           string    `db:"host"`
	Port           int       `db:"port"`
	Username       string    `db:"username"`
	PasswordCipher []byte    `db:"password_cipher"`
	FromName       string    `db:"from_name"`
	FromEmail      string    `db:"from_email"`
	ReplyTo        string    `db:"reply_to"`
	Enabled        bool      `db:"enabled"`
	CreatedAt      time.Time `db:"created_at"`
	UpdatedAt      time.Time `db:"updated_at"`
}

// GetWorkspaceSMTP loads a workspace's SMTP configuration. Returns
// sql.ErrNoRows when none is stored.
func (s *Store) GetWorkspaceSMTP(ctx context.Context, workspaceID string) (*WorkspaceSMTP, error) {
	var ws WorkspaceSMTP
	err := s.db.GetContext(ctx, &ws, `
		SELECT workspace_id, host, port,
		       COALESCE(username, '') AS username,
		       password_cipher,
		       COALESCE(from_name, '') AS from_name,
		       COALESCE(from_email, '') AS from_email,
		       COALESCE(reply_to, '') AS reply_to,
		       COALESCE(enabled, 0) AS enabled,
		       created_at, updated_at
		FROM workspace_smtp WHERE workspace_id = ?`, workspaceID)
	if err != nil {
		return nil, err
	}
	return &ws, nil
}

// UpsertWorkspaceSMTP inserts or replaces a workspace's SMTP configuration.
func (s *Store) UpsertWorkspaceSMTP(ctx context.Context, ws *WorkspaceSMTP) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO workspace_smtp (workspace_id, host, port, username, password_cipher,
		                            from_name, from_email, reply_to, enabled)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			host            = VALUES(host),
			port            = VALUES(port),
			username        = VALUES(username),
			password_cipher = VALUES(password_cipher),
			from_name       = VALUES(from_name),
			from_email      = VALUES(from_email),
			reply_to        = VALUES(reply_to),
			enabled         = VALUES(enabled)`,
		ws.WorkspaceID, ws.Host, ws.Port, ws.Username,
		nullIfEmptyBytes(ws.PasswordCipher),
		ws.FromName, ws.FromEmail, ws.ReplyTo, ws.Enabled)
	return err
}

// DeleteWorkspaceSMTP removes a workspace's SMTP configuration.
func (s *Store) DeleteWorkspaceSMTP(ctx context.Context, workspaceID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM workspace_smtp WHERE workspace_id = ?`, workspaceID)
	return err
}
