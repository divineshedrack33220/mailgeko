package store

import (
	"context"
	"database/sql"
	"time"
)

type Notification struct {
	ID          string     `db:"id"`
	WorkspaceID string     `db:"workspace_id"`
	UserID      string     `db:"user_id"`
	Type        string     `db:"type"`
	Title       string     `db:"title"`
	Body        string     `db:"body"`
	Link        string     `db:"link"`
	ReadAt      *time.Time `db:"read_at"`
	CreatedAt   time.Time  `db:"created_at"`
}

func (s *Store) ListNotifications(ctx context.Context, workspaceID string, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, workspace_id, user_id, type, title, body, link, read_at, created_at
		 FROM notifications WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
		workspaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Notification, 0, limit)
	for rows.Next() {
		var n Notification
		var readAt sql.NullTime
		if err := rows.Scan(&n.ID, &n.WorkspaceID, &n.UserID, &n.Type, &n.Title, &n.Body,
			&n.Link, &readAt, &n.CreatedAt); err != nil {
			return nil, err
		}
		if readAt.Valid {
			t := readAt.Time
			n.ReadAt = &t
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) UnreadNotificationCount(ctx context.Context, workspaceID string) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notifications WHERE workspace_id = ? AND read_at IS NULL`, workspaceID).
		Scan(&count)
	return count, err
}

func (s *Store) MarkNotificationRead(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE workspace_id = ? AND id = ?`,
		workspaceID, id)
	return err
}

func (s *Store) MarkAllNotificationsRead(ctx context.Context, workspaceID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE workspace_id = ? AND read_at IS NULL`,
		workspaceID)
	return err
}

func (s *Store) CreateNotification(ctx context.Context, n *Notification) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO notifications (id, workspace_id, user_id, type, title, body, link)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		n.ID, n.WorkspaceID, n.UserID, n.Type, n.Title, n.Body, n.Link)
	return err
}

func (s *Store) WorkspaceOwnerUserID(ctx context.Context, workspaceID string) (string, error) {
	var userID string
	err := s.db.QueryRowContext(ctx,
		`SELECT user_id FROM workspace_members
		 WHERE workspace_id = ? ORDER BY (role = 'owner') DESC, created_at ASC LIMIT 1`,
		workspaceID).Scan(&userID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return userID, err
}
