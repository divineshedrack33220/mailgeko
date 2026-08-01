package store

import (
	"context"
	"encoding/json"
	"time"
)

type automationRow struct {
	ID                string    `db:"id"`
	WorkspaceID       string    `db:"workspace_id"`
	Name              string    `db:"name"`
	Description       string    `db:"description"`
	TriggerType       string    `db:"trigger_type"`
	TriggerLabel      string    `db:"trigger_label"`
	TriggerConditions []byte    `db:"trigger_conditions"`
	TriggerDelay      *int      `db:"trigger_delay"`
	Steps             []byte    `db:"steps"`
	Status            string    `db:"status"`
	CreatedAt         time.Time `db:"created_at"`
	UpdatedAt         time.Time `db:"updated_at"`
}

func (r automationRow) toAutomation() *Automation {
	return &Automation{
		ID:           r.ID,
		WorkspaceID:  r.WorkspaceID,
		Name:         r.Name,
		Description:  r.Description,
		TriggerType:  r.TriggerType,
		TriggerLabel: r.TriggerLabel,
		TriggerDelay: r.TriggerDelay,
		Steps:        r.Steps,
		Status:       r.Status,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

func (r automationRow) triggerConditions() []Condition {
	var out []Condition
	if len(r.TriggerConditions) > 0 {
		_ = json.Unmarshal(r.TriggerConditions, &out)
	}
	return out
}

func (s *Store) CreateAutomation(ctx context.Context, a *Automation) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO automations (id, workspace_id, name, description, trigger_type, trigger_label,
			trigger_conditions, trigger_delay, steps, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.WorkspaceID, a.Name, a.Description, a.TriggerType, a.TriggerLabel,
		marshalJSON(a.TriggerConditions), a.TriggerDelay, a.Steps, a.Status)
	return err
}

func (s *Store) GetAutomation(ctx context.Context, workspaceID, id string) (*Automation, error) {
	var r automationRow
	err := s.db.GetContext(ctx, &r, `
		SELECT id, workspace_id, name, description, trigger_type, trigger_label,
			trigger_conditions, trigger_delay, steps, status, created_at, updated_at
		FROM automations WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	if err != nil {
		return nil, err
	}
	return r.toAutomation(), nil
}

func (s *Store) ListAutomations(ctx context.Context, workspaceID string) ([]*Automation, error) {
	rows, err := s.db.QueryxContext(ctx, `
		SELECT id, workspace_id, name, description, trigger_type, trigger_label,
			trigger_conditions, trigger_delay, steps, status, created_at, updated_at
		FROM automations WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Automation
	for rows.Next() {
		var r automationRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toAutomation())
	}
	return out, rows.Err()
}

func (s *Store) UpdateAutomation(ctx context.Context, a *Automation) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE automations SET name = ?, description = ?, trigger_type = ?, trigger_label = ?,
			trigger_conditions = ?, trigger_delay = ?, steps = ?, status = ?
		WHERE workspace_id = ? AND id = ?`,
		a.Name, a.Description, a.TriggerType, a.TriggerLabel,
		marshalJSON(a.TriggerConditions), a.TriggerDelay, a.Steps, a.Status, a.WorkspaceID, a.ID)
	return err
}

func (s *Store) DeleteAutomation(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM automations WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}
