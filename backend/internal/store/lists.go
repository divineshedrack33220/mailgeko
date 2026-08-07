package store

import (
	"context"
	"time"
)

type listRow struct {
	ID          string    `db:"id"`
	WorkspaceID string    `db:"workspace_id"`
	Name        string    `db:"name"`
	Description string    `db:"description"`
	CreatedAt   time.Time `db:"created_at"`
}

func (r listRow) toList() *List {
	return &List{ID: r.ID, WorkspaceID: r.WorkspaceID, Name: r.Name, Description: r.Description, CreatedAt: r.CreatedAt}
}

func (s *Store) CreateList(ctx context.Context, l *List) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO lists (id, workspace_id, name, description) VALUES (?, ?, ?, ?)`,
		l.ID, l.WorkspaceID, l.Name, l.Description)
	return err
}

func (s *Store) GetList(ctx context.Context, workspaceID, id string) (*List, error) {
	var r listRow
	err := s.db.GetContext(ctx, &r,
		`SELECT id, workspace_id, name, description, created_at FROM lists WHERE workspace_id = ? AND id = ?`,
		workspaceID, id)
	if err != nil {
		return nil, err
	}
	return r.toList(), nil
}

func (s *Store) ListLists(ctx context.Context, workspaceID string) ([]*List, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT id, workspace_id, name, description, created_at FROM lists
		 WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*List
	for rows.Next() {
		var r listRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toList())
	}
	return out, rows.Err()
}

type ListWithCount struct {
	List
	ContactCount int64
}

type listCountRow struct {
	listRow
	ContactCount int64 `db:"contact_count"`
}

func (r listCountRow) toListWithCount() *ListWithCount {
	return &ListWithCount{List: *r.listRow.toList(), ContactCount: r.ContactCount}
}

func (s *Store) ListListsWithCounts(ctx context.Context, workspaceID string) ([]*ListWithCount, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT l.id, l.workspace_id, l.name, l.description, l.created_at,
		        COUNT(c.id) AS contact_count
		 FROM lists l
		 LEFT JOIN list_members lm ON lm.list_id = l.id
		 LEFT JOIN contacts c ON c.id = lm.contact_id AND c.workspace_id = l.workspace_id
		 WHERE l.workspace_id = ?
		 GROUP BY l.id, l.workspace_id, l.name, l.description, l.created_at
		 ORDER BY l.created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*ListWithCount
	for rows.Next() {
		var r listCountRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toListWithCount())
	}
	return out, rows.Err()
}

func (s *Store) UpdateList(ctx context.Context, l *List) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE lists SET name = ?, description = ? WHERE workspace_id = ? AND id = ?`,
		l.Name, l.Description, l.WorkspaceID, l.ID)
	return err
}

func (s *Store) DeleteList(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM lists WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}

func (s *Store) ListContactCount(ctx context.Context, workspaceID, listID string) (int64, error) {
	var n int64
	err := s.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM list_members lm
		 JOIN contacts c ON c.id = lm.contact_id
		 WHERE lm.list_id = ? AND c.workspace_id = ?`, listID, workspaceID)
	return n, err
}

func (s *Store) AddContactToList(ctx context.Context, listID, contactID string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT IGNORE INTO list_members (list_id, contact_id) VALUES (?, ?)`, listID, contactID)
	return err
}

func (s *Store) RemoveContactFromList(ctx context.Context, listID, contactID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM list_members WHERE list_id = ? AND contact_id = ?`, listID, contactID)
	return err
}

func (s *Store) ListContactIDs(ctx context.Context, listID string) ([]string, error) {
	var ids []string
	err := s.db.SelectContext(ctx, &ids,
		`SELECT contact_id FROM list_members WHERE list_id = ?`, listID)
	return ids, err
}

func (s *Store) ContactListIDs(ctx context.Context, contactID string) ([]string, error) {
	var ids []string
	err := s.db.SelectContext(ctx, &ids,
		`SELECT list_id FROM list_members WHERE contact_id = ?`, contactID)
	return ids, err
}
