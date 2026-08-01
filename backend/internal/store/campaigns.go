package store

import (
	"context"
	"database/sql"
	"time"
)

type campaignRow struct {
	ID               string         `db:"id"`
	WorkspaceID      string         `db:"workspace_id"`
	Name             string         `db:"name"`
	Subject          string         `db:"subject"`
	TemplateID       sql.NullString `db:"template_id"`
	PreviewText      string         `db:"preview_text"`
	PlainText        string         `db:"plain_text"`
	HTMLContent      string         `db:"html_content"`
	Status           string         `db:"status"`
	Type             string         `db:"type"`
	ListIDs          []byte         `db:"list_ids"`
	SegmentIDs       []byte         `db:"segment_ids"`
	ScheduleAt       *time.Time     `db:"schedule_at"`
	FromName         string         `db:"from_name"`
	FromEmail        string         `db:"from_email"`
	ReplyTo          string         `db:"reply_to"`
	TrackOpens       bool           `db:"track_opens"`
	TrackClicks      bool           `db:"track_clicks"`
	AllowUnsubscribe bool           `db:"allow_unsubscribe"`
	CreatedAt        time.Time      `db:"created_at"`
	UpdatedAt        time.Time      `db:"updated_at"`
}

func (r campaignRow) toCampaign() *Campaign {
	return &Campaign{
		ID:               r.ID,
		WorkspaceID:      r.WorkspaceID,
		Name:             r.Name,
		Subject:          r.Subject,
		TemplateID:       r.TemplateID.String,
		PreviewText:      r.PreviewText,
		PlainText:        r.PlainText,
		HTMLContent:      r.HTMLContent,
		Status:           r.Status,
		Type:             r.Type,
		ListIDs:          unmarshalStringSlice(r.ListIDs),
		SegmentIDs:       unmarshalStringSlice(r.SegmentIDs),
		ScheduleAt:       r.ScheduleAt,
		FromName:         r.FromName,
		FromEmail:        r.FromEmail,
		ReplyTo:          r.ReplyTo,
		TrackOpens:       r.TrackOpens,
		TrackClicks:      r.TrackClicks,
		AllowUnsubscribe: r.AllowUnsubscribe,
		CreatedAt:        r.CreatedAt,
		UpdatedAt:        r.UpdatedAt,
	}
}

const campaignColumns = `id, workspace_id, name, subject, template_id, preview_text, plain_text,
	html_content, status, type, list_ids, segment_ids, schedule_at,
	from_name, from_email, reply_to, track_opens, track_clicks, allow_unsubscribe,
	created_at, updated_at`

func (s *Store) CreateCampaign(ctx context.Context, c *Campaign) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO campaigns (id, workspace_id, name, subject, template_id, preview_text,
			plain_text, html_content, status, type, list_ids, segment_ids, schedule_at,
			from_name, from_email, reply_to, track_opens, track_clicks, allow_unsubscribe)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.WorkspaceID, c.Name, c.Subject, nullableStr(c.TemplateID), c.PreviewText,
		c.PlainText, c.HTMLContent, c.Status, c.Type, marshalJSON(c.ListIDs), marshalJSON(c.SegmentIDs),
		nullableTime(c.ScheduleAt), c.FromName, c.FromEmail, c.ReplyTo,
		c.TrackOpens, c.TrackClicks, c.AllowUnsubscribe)
	return err
}

func (s *Store) GetCampaign(ctx context.Context, workspaceID, id string) (*Campaign, error) {
	var r campaignRow
	err := s.db.GetContext(ctx, &r,
		`SELECT `+campaignColumns+` FROM campaigns WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	if err != nil {
		return nil, err
	}
	return r.toCampaign(), nil
}

func (s *Store) GetCampaignByID(ctx context.Context, id string) (*Campaign, error) {
	var r campaignRow
	err := s.db.GetContext(ctx, &r,
		`SELECT `+campaignColumns+` FROM campaigns WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	return r.toCampaign(), nil
}

func (s *Store) ListCampaigns(ctx context.Context, workspaceID string) ([]*Campaign, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT `+campaignColumns+` FROM campaigns WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Campaign
	for rows.Next() {
		var r campaignRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, r.toCampaign())
	}
	return out, rows.Err()
}

func (s *Store) UpdateCampaign(ctx context.Context, c *Campaign) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE campaigns SET name = ?, subject = ?, template_id = ?, preview_text = ?,
			plain_text = ?, html_content = ?, list_ids = ?, segment_ids = ?, schedule_at = ?,
			from_name = ?, from_email = ?, reply_to = ?, track_opens = ?, track_clicks = ?,
			allow_unsubscribe = ? WHERE workspace_id = ? AND id = ?`,
		c.Name, c.Subject, nullableStr(c.TemplateID), c.PreviewText, c.PlainText, c.HTMLContent,
		marshalJSON(c.ListIDs), marshalJSON(c.SegmentIDs), nullableTime(c.ScheduleAt),
		c.FromName, c.FromEmail, c.ReplyTo, c.TrackOpens, c.TrackClicks, c.AllowUnsubscribe,
		c.WorkspaceID, c.ID)
	return err
}

func (s *Store) SetCampaignStatus(ctx context.Context, workspaceID, id, status string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaigns SET status = ? WHERE workspace_id = ? AND id = ?`, status, workspaceID, id)
	return err
}

func (s *Store) DeleteCampaign(ctx context.Context, workspaceID, id string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM campaigns WHERE workspace_id = ? AND id = ?`, workspaceID, id)
	return err
}

func (s *Store) EnsureCampaignStats(ctx context.Context, campaignID string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT IGNORE INTO campaign_stats (campaign_id) VALUES (?)`, campaignID)
	return err
}

func (s *Store) GetCampaignStats(ctx context.Context, campaignID string) (*CampaignStats, error) {
	var st CampaignStats
	err := s.db.GetContext(ctx, &st,
		`SELECT campaign_id, recipients, sent, delivered, opened, clicked, bounced, complained,
			unsubscribed, unique_opens, unique_clicks FROM campaign_stats WHERE campaign_id = ?`, campaignID)
	if err == sql.ErrNoRows {
		return &CampaignStats{CampaignID: campaignID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// WorkspaceTotals sums delivery/engagement counters across all non-test
// campaigns in a workspace. Used by the Reports overview.
func (s *Store) WorkspaceTotals(ctx context.Context, workspaceID string) (*CampaignStats, error) {
	var st CampaignStats
	err := s.db.GetContext(ctx, &st, `
		SELECT COALESCE(SUM(recipients), 0) AS recipients,
		       COALESCE(SUM(sent), 0) AS sent,
		       COALESCE(SUM(delivered), 0) AS delivered,
		       COALESCE(SUM(opened), 0) AS opened,
		       COALESCE(SUM(clicked), 0) AS clicked,
		       COALESCE(SUM(bounced), 0) AS bounced,
		       COALESCE(SUM(complained), 0) AS complained,
		       COALESCE(SUM(unsubscribed), 0) AS unsubscribed,
		       COALESCE(SUM(unique_opens), 0) AS unique_opens,
		       COALESCE(SUM(unique_clicks), 0) AS unique_clicks
		FROM campaign_stats cs
		JOIN campaigns c ON c.id = cs.campaign_id
		WHERE c.workspace_id = ? AND c.type <> 'test'`, workspaceID)
	if err == sql.ErrNoRows {
		return &CampaignStats{}, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func nullableStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullableTime(t *time.Time) any {
	if t == nil {
		return nil
	}
	return *t
}
