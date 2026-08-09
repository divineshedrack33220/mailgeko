package store

import (
	"context"
	"sort"
	"time"

	"github.com/jmoiron/sqlx"
)

type contactRow struct {
	ID               string     `db:"id"`
	WorkspaceID      string     `db:"workspace_id"`
	Email            string     `db:"email"`
	FirstName        string     `db:"first_name"`
	LastName         string     `db:"last_name"`
	Company          string     `db:"company"`
	Position         string     `db:"position"`
	Country          string     `db:"country"`
	City             string     `db:"city"`
	PhoneNumber      string     `db:"phone_number"`
	CustomFields     []byte     `db:"custom_fields"`
	Tags             []byte     `db:"tags"`
	Status           string     `db:"status"`
	LastEngagementAt *time.Time `db:"last_engagement_at"`
	CreatedAt        time.Time  `db:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at"`
}

func (r contactRow) toContact() *Contact {
	return &Contact{
		ID:               r.ID,
		WorkspaceID:      r.WorkspaceID,
		Email:            r.Email,
		FirstName:        r.FirstName,
		LastName:         r.LastName,
		Company:          r.Company,
		Position:         r.Position,
		Country:          r.Country,
		City:             r.City,
		PhoneNumber:      r.PhoneNumber,
		CustomFields:     unmarshalStringMap(r.CustomFields),
		Tags:             unmarshalStringSlice(r.Tags),
		Status:           r.Status,
		LastEngagementAt: r.LastEngagementAt,
		CreatedAt:        r.CreatedAt,
		UpdatedAt:        r.UpdatedAt,
	}
}

const contactColumns = `id, workspace_id, email, first_name, last_name, company, position,
	country, city, phone_number, custom_fields, tags, status,
	last_engagement_at, created_at, updated_at`

type ContactFilter struct {
	Query  string
	Status string
	Limit  int
	Offset int
	ListID string
}

func (f ContactFilter) withDefaults() ContactFilter {
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 50
	}
	return f
}

func (s *Store) ListContacts(ctx context.Context, workspaceID string, f ContactFilter) ([]*Contact, error) {
	f = f.withDefaults()
	args := []any{workspaceID}
	where := "WHERE workspace_id = ?"
	if f.Status != "" {
		where += " AND status = ?"
		args = append(args, f.Status)
	}
	if f.Query != "" {
		where += " AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)"
		like := "%" + f.Query + "%"
		args = append(args, like, like, like, like)
	}
	if f.ListID != "" {
		where += ` AND contacts.id IN (
			SELECT lm.contact_id FROM list_members lm
			JOIN lists l ON l.id = lm.list_id
			WHERE lm.list_id = ? AND l.workspace_id = ?)`
		args = append(args, f.ListID, workspaceID)
	}
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.QueryxContext(ctx, `
		SELECT `+contactColumns+` FROM contacts `+where+`
		ORDER BY created_at DESC LIMIT ? OFFSET ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Contact
	for rows.Next() {
		var r contactRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toContact())
	}
	return out, rows.Err()
}

func (s *Store) CountContacts(ctx context.Context, workspaceID string) (int64, error) {
	var n int64
	err := s.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM contacts WHERE workspace_id = ?`, workspaceID)
	return n, err
}

func (s *Store) GetContact(ctx context.Context, workspaceID, id string) (*Contact, error) {
	var r contactRow
	err := s.db.GetContext(ctx, &r,
		`SELECT `+contactColumns+` FROM contacts WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	if err != nil {
		return nil, err
	}
	return r.toContact(), nil
}

func (s *Store) GetContactByID(ctx context.Context, id string) (*Contact, error) {
	var r contactRow
	err := s.db.GetContext(ctx, &r,
		`SELECT `+contactColumns+` FROM contacts WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	return r.toContact(), nil
}

func (s *Store) AllContacts(ctx context.Context, workspaceID string) ([]*Contact, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT `+contactColumns+` FROM contacts WHERE workspace_id = ?`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Contact
	for rows.Next() {
		var r contactRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toContact())
	}
	return out, rows.Err()
}

func (s *Store) UpdateContact(ctx context.Context, c *Contact) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE contacts SET email = ?, first_name = ?, last_name = ?, company = ?, position = ?,
			country = ?, city = ?, phone_number = ?, custom_fields = ?, tags = ?, status = ?
		WHERE workspace_id = ? AND id = ?`,
		c.Email, c.FirstName, c.LastName, c.Company, c.Position, c.Country, c.City,
		c.PhoneNumber, marshalJSON(c.CustomFields), marshalJSON(c.Tags), c.Status,
		c.WorkspaceID, c.ID)
	return err
}

func (s *Store) DeleteContact(ctx context.Context, workspaceID, id string) error {
	return s.WithTx(ctx, func(tx *sqlx.Tx) error {
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM contacts WHERE workspace_id = ? AND id = ?`, workspaceID, id); err != nil {
			return err
		}
		// Clean up the contact's automation runs and delivery records so
		// orphaned rows don't inflate "in flow" counts or totals forever.
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM automation_runs WHERE contact_id = ?`, id); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx,
			`DELETE FROM campaign_recipients WHERE contact_id = ?`, id)
		return err
	})
}

func (s *Store) UpdateContactStatus(ctx context.Context, workspaceID, id, status string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE contacts SET status = ? WHERE workspace_id = ? AND id = ?`, status, workspaceID, id)
	return err
}

func (s *Store) MarkContactEngagement(ctx context.Context, workspaceID, contactID string, at time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE contacts SET last_engagement_at = GREATEST(COALESCE(last_engagement_at, ?), ?)
		 WHERE workspace_id = ? AND id = ?`, at, at, workspaceID, contactID)
	return err
}

func (s *Store) ContactsByIDs(ctx context.Context, workspaceID string, ids []string) ([]*Contact, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	query, args, err := sqlIn(contactColumns, "contacts", "workspace_id", "id", workspaceID, ids)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.QueryxContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Contact
	for rows.Next() {
		var r contactRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toContact())
	}
	return out, rows.Err()
}

func sqlIn(columns, table, wsCol, idCol, workspaceID string, ids []string) (string, []any, error) {
	placeholders := ""
	args := make([]any, 0, len(ids)+1)
	args = append(args, workspaceID)
	for i, id := range ids {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args = append(args, id)
	}
	return "SELECT " + columns + " FROM " + table + " WHERE " + wsCol + " = ? AND " + idCol + " IN (" + placeholders + ")", args, nil
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

func (s *Store) TagCounts(ctx context.Context, workspaceID string) ([]TagCount, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT tags FROM contacts WHERE workspace_id = ?`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int64)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		for _, t := range unmarshalStringSlice(raw) {
			counts[t]++
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]TagCount, 0, len(counts))
	for tag, count := range counts {
		out = append(out, TagCount{Tag: tag, Count: count})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Tag < out[j].Tag
	})
	return out, nil
}
