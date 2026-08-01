package store

import (
	"context"
	"time"
)

type segmentRow struct {
	ID          string    `db:"id"`
	WorkspaceID string    `db:"workspace_id"`
	Name        string    `db:"name"`
	Description string    `db:"description"`
	MatchType   string    `db:"match_type"`
	Conditions  []byte    `db:"conditions"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

func (r segmentRow) toSegment() *Segment {
	seg := &Segment{
		ID:          r.ID,
		WorkspaceID: r.WorkspaceID,
		Name:        r.Name,
		Description: r.Description,
		MatchType:   r.MatchType,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
	if len(r.Conditions) > 0 {
		_ = jsonUnmarshal(r.Conditions, &seg.Conditions)
	}
	return seg
}

func (s *Store) CreateSegment(ctx context.Context, seg *Segment) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO segments (id, workspace_id, name, description, match_type, conditions)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		seg.ID, seg.WorkspaceID, seg.Name, seg.Description, seg.MatchType, marshalJSON(seg.Conditions))
	return err
}

func (s *Store) GetSegment(ctx context.Context, workspaceID, id string) (*Segment, error) {
	var r segmentRow
	err := s.db.GetContext(ctx, &r,
		`SELECT id, workspace_id, name, description, match_type, conditions, created_at, updated_at
		 FROM segments WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	if err != nil {
		return nil, err
	}
	return r.toSegment(), nil
}

func (s *Store) ListSegments(ctx context.Context, workspaceID string) ([]*Segment, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT id, workspace_id, name, description, match_type, conditions, created_at, updated_at
		 FROM segments WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Segment
	for rows.Next() {
		var r segmentRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toSegment())
	}
	return out, rows.Err()
}

func (s *Store) UpdateSegment(ctx context.Context, seg *Segment) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE segments SET name = ?, description = ?, match_type = ?, conditions = ?
		 WHERE workspace_id = ? AND id = ?`,
		seg.Name, seg.Description, seg.MatchType, marshalJSON(seg.Conditions), seg.WorkspaceID, seg.ID)
	return err
}

func (s *Store) DeleteSegment(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM segments WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}

func (s *Store) SegmentIDsByWorkspace(ctx context.Context, workspaceID string) ([]string, error) {
	var ids []string
	err := s.db.SelectContext(ctx, &ids,
		`SELECT id FROM segments WHERE workspace_id = ?`, workspaceID)
	return ids, err
}
