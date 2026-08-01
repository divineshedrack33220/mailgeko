package store

import (
	"context"

	"github.com/jmoiron/sqlx"
)

type Store struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *Store {
	return &Store{db: db}
}

func (s *Store) WithTx(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (s *Store) ContactByEmail(ctx context.Context, workspaceID, email string) (*Contact, error) {
	row := contactRow{}
	err := s.db.GetContext(ctx, &row, `
		SELECT id, workspace_id, email, first_name, last_name, company, position,
		       country, city, phone_number, custom_fields, tags, status,
		       last_engagement_at, created_at, updated_at
		FROM contacts WHERE workspace_id = ? AND email = ?`, workspaceID, email)
	if err != nil {
		return nil, err
	}
	return row.toContact(), nil
}

func (s *Store) CreateContact(ctx context.Context, c *Contact) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO contacts (id, workspace_id, email, first_name, last_name, company,
		                      position, country, city, phone_number, custom_fields, tags, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.WorkspaceID, c.Email, c.FirstName, c.LastName, c.Company,
		c.Position, c.Country, c.City, c.PhoneNumber,
		marshalJSON(c.CustomFields), marshalJSON(c.Tags), c.Status)
	return err
}

func (s *Store) UpsertContact(ctx context.Context, c *Contact) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO contacts (id, workspace_id, email, first_name, last_name, company,
		                      position, country, city, phone_number, custom_fields, tags, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			first_name = VALUES(first_name),
			last_name  = VALUES(last_name),
			company    = VALUES(company),
			position   = VALUES(position),
			country    = VALUES(country),
			city       = VALUES(city),
			phone_number = VALUES(phone_number),
			custom_fields = VALUES(custom_fields),
			tags       = VALUES(tags),
			status     = VALUES(status)`,
		c.ID, c.WorkspaceID, c.Email, c.FirstName, c.LastName, c.Company,
		c.Position, c.Country, c.City, c.PhoneNumber,
		marshalJSON(c.CustomFields), marshalJSON(c.Tags), c.Status)
	return err
}
