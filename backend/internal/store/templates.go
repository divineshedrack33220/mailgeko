package store

import (
	"context"
	"time"
)

type templateRow struct {
	ID          string    `db:"id"`
	WorkspaceID string    `db:"workspace_id"`
	Name        string    `db:"name"`
	Description string    `db:"description"`
	Category    string    `db:"category"`
	Thumbnail   string    `db:"thumbnail"`
	MJML        string    `db:"mjml"`
	HTML        string    `db:"html"`
	Variables   []byte    `db:"variables"`
	Tags        []byte    `db:"tags"`
	IsFavorite  bool      `db:"is_favorite"`
	UsedCount   int64     `db:"used_count"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

func (r templateRow) toTemplate() *Template {
	return &Template{
		ID:          r.ID,
		WorkspaceID: r.WorkspaceID,
		Name:        r.Name,
		Description: r.Description,
		Category:    r.Category,
		Thumbnail:   r.Thumbnail,
		MJML:        r.MJML,
		HTML:        r.HTML,
		Variables:   unmarshalStringSlice(r.Variables),
		Tags:        unmarshalStringSlice(r.Tags),
		IsFavorite:  r.IsFavorite,
		UsedCount:   r.UsedCount,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

const templateColumns = `id, workspace_id, name, description, category, thumbnail, mjml, html,
	variables, tags, is_favorite, used_count, created_at, updated_at`

func (s *Store) CreateTemplate(ctx context.Context, t *Template) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO templates (id, workspace_id, name, description, category, thumbnail, mjml, html, variables, tags, is_favorite)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.WorkspaceID, t.Name, t.Description, t.Category, t.Thumbnail, t.MJML, t.HTML,
		marshalJSON(t.Variables), marshalJSON(t.Tags), t.IsFavorite)
	return err
}

func (s *Store) GetTemplate(ctx context.Context, workspaceID, id string) (*Template, error) {
	var r templateRow
	err := s.db.GetContext(ctx, &r,
		`SELECT `+templateColumns+` FROM templates WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	if err != nil {
		return nil, err
	}
	return r.toTemplate(), nil
}

func (s *Store) ListTemplates(ctx context.Context, workspaceID string) ([]*Template, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT `+templateColumns+` FROM templates WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Template
	for rows.Next() {
		var r templateRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toTemplate())
	}
	return out, rows.Err()
}

func (s *Store) UpdateTemplate(ctx context.Context, t *Template) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE templates SET name = ?, description = ?, category = ?, thumbnail = ?, mjml = ?,
			html = ?, variables = ?, tags = ?, is_favorite = ?, updated_at = NOW() WHERE workspace_id = ? AND id = ?`,
		t.Name, t.Description, t.Category, t.Thumbnail, t.MJML, t.HTML,
		marshalJSON(t.Variables), marshalJSON(t.Tags), t.IsFavorite, t.WorkspaceID, t.ID)
	return err
}

func (s *Store) DeleteTemplate(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM templates WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}

func (s *Store) IncrementTemplateUsed(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE templates SET used_count = used_count + 1 WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}
