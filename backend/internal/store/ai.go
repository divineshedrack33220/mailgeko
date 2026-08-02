package store

import (
	"context"
	"time"
)

type AIHistory struct {
	ID          string    `db:"id"`
	WorkspaceID string    `db:"workspace_id"`
	Kind        string    `db:"kind"`
	Prompt      string    `db:"prompt"`
	Result      string    `db:"result"`
	CreatedAt   time.Time `db:"created_at"`
}

func (s *Store) CreateAIHistory(ctx context.Context, h *AIHistory) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO ai_history (id, workspace_id, kind, prompt, result)
		 VALUES (?, ?, ?, ?, ?)`,
		h.ID, h.WorkspaceID, h.Kind, nullIfEmpty(h.Prompt), nullIfEmpty(h.Result))
	return err
}

func (s *Store) ListAIHistory(ctx context.Context, workspaceID string, limit int) ([]AIHistory, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, workspace_id, kind, COALESCE(prompt, '') AS prompt,
		        COALESCE(result, '') AS result, created_at
		 FROM ai_history WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
		workspaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AIHistory, 0, limit)
	for rows.Next() {
		var h AIHistory
		if err := rows.Scan(&h.ID, &h.WorkspaceID, &h.Kind, &h.Prompt, &h.Result, &h.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (s *Store) DeleteAIHistory(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM ai_history WHERE id = ? AND workspace_id = ?`, id, workspaceID)
	return err
}
