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
			allow_unsubscribe = ?, status = ? WHERE workspace_id = ? AND id = ?`,
		c.Name, c.Subject, nullableStr(c.TemplateID), c.PreviewText, c.PlainText, c.HTMLContent,
		marshalJSON(c.ListIDs), marshalJSON(c.SegmentIDs), nullableTime(c.ScheduleAt),
		c.FromName, c.FromEmail, c.ReplyTo, c.TrackOpens, c.TrackClicks, c.AllowUnsubscribe,
		c.Status, c.WorkspaceID, c.ID)
	return err
}

func (s *Store) SetCampaignStatus(ctx context.Context, workspaceID, id, status string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaigns SET status = ? WHERE workspace_id = ? AND id = ?`, status, workspaceID, id)
	return err
}

// ClaimCampaignForSend atomically moves a campaign into 'sending' so a manual
// send, the scheduler and a retried send task can never start the same
// campaign twice. It reports whether this caller won the claim.
func (s *Store) ClaimCampaignForSend(ctx context.Context, workspaceID, id string) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE campaigns SET status = 'sending', updated_at = ?
		 WHERE workspace_id = ? AND id = ? AND status IN ('draft', 'scheduled', 'paused', 'failed')`,
		time.Now().UTC(), workspaceID, id)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// ListDueScheduledCampaigns returns campaigns whose send time has arrived and
// that are still waiting to go out (draft or scheduled, not paused/sent).
func (s *Store) ListDueScheduledCampaigns(ctx context.Context, now time.Time) ([]Campaign, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT `+campaignColumns+` FROM campaigns
		 WHERE status IN ('draft', 'scheduled')
		   AND schedule_at IS NOT NULL
		   AND schedule_at <= ?`,
		now.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Campaign
	for rows.Next() {
		var r campaignRow
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, *r.toCampaign())
	}
	return out, rows.Err()
}

// MarkCampaignScheduled atomically claims a due campaign so it is enqueued
// exactly once even across multiple scheduler instances. The campaign is moved
// out of the states ListDueScheduledCampaigns selects, so only the first
// claimant observes a row change. It reports whether this caller won the claim.
func (s *Store) MarkCampaignScheduled(ctx context.Context, id string) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE campaigns SET status = 'sending', updated_at = ?
		 WHERE id = ? AND status IN ('draft', 'scheduled')`, time.Now().UTC(), id)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// RecoverStuckSendingCampaigns resets campaigns that have been stuck in
// 'sending' status beyond the given timeout. This handles the case where a
// worker crashed mid-send: the campaign is left in 'sending' with no active
// worker to complete it. Stuck campaigns are reset to 'failed' so the user
// can retry.
//
// A campaign is only recovered when its recipients show no recent activity.
// Large sends can legitimately run for many hours, so the campaign's own
// updated_at (which is not touched per recipient) is not a reliable stall
// signal on its own; the most recent sent_at across recipients is.
func (s *Store) RecoverStuckSendingCampaigns(ctx context.Context, now time.Time, timeout time.Duration) (int64, error) {
	cutoff := now.Add(-timeout)
	res, err := s.db.ExecContext(ctx,
		`UPDATE campaigns SET status = 'failed', updated_at = ?
		 WHERE status = 'sending' AND updated_at < ?
		   AND COALESCE((SELECT MAX(sent_at) FROM campaign_recipients
		                 WHERE campaign_id = campaigns.id), 0) < ?`,
		now.UTC(), cutoff.UTC(), cutoff.UTC())
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
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
		`SELECT cs.campaign_id, cs.recipients, cs.sent, cs.delivered, cs.opened, cs.clicked,
		        cs.bounced, cs.complained, cs.unsubscribed, cs.unique_opens, cs.unique_clicks,
		        COALESCE(a.auto_recipients, 0) AS auto_recipients,
		        COALESCE(a.auto_sent, 0) AS auto_sent
		 FROM campaign_stats cs
		 LEFT JOIN (
		    SELECT campaign_id, COUNT(*) AS auto_recipients, COUNT(sent_at) AS auto_sent
		    FROM campaign_recipients
		    WHERE automation_run_id IS NOT NULL
		    GROUP BY campaign_id
		 ) a ON a.campaign_id = cs.campaign_id
		 WHERE cs.campaign_id = ?`, campaignID)
	if err == sql.ErrNoRows {
		return &CampaignStats{CampaignID: campaignID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// WorkspaceTotals sums delivery/engagement counters across all non-test
// campaigns in a workspace. Used by the Reports overview. Automation sends
// never write campaign_stats rows for recipients/sent (they live in
// campaign_recipients with an automation_run_id), so those two counters are
// padded from the recipient table to match billing's email count.
func (s *Store) WorkspaceTotals(ctx context.Context, workspaceID string) (*CampaignStats, error) {
	var st CampaignStats
	err := s.db.GetContext(ctx, &st, `
		SELECT COALESCE(SUM(cs.recipients), 0)
		         + COALESCE((SELECT COUNT(*) FROM campaign_recipients r
		                     JOIN campaigns ac ON ac.id = r.campaign_id
		                     WHERE ac.workspace_id = ? AND ac.type <> 'test'
		                       AND r.automation_run_id IS NOT NULL), 0) AS recipients,
		       COALESCE(SUM(cs.sent), 0)
		         + COALESCE((SELECT COUNT(*) FROM campaign_recipients r
		                     JOIN campaigns ac ON ac.id = r.campaign_id
		                     WHERE ac.workspace_id = ? AND ac.type <> 'test'
		                       AND r.automation_run_id IS NOT NULL
		                       AND r.sent_at IS NOT NULL), 0) AS sent,
		       COALESCE(SUM(cs.delivered), 0) AS delivered,
		       COALESCE(SUM(cs.opened), 0) AS opened,
		       COALESCE(SUM(cs.clicked), 0) AS clicked,
		       COALESCE(SUM(cs.bounced), 0) AS bounced,
		       COALESCE(SUM(cs.complained), 0) AS complained,
		       COALESCE(SUM(cs.unsubscribed), 0) AS unsubscribed,
		       COALESCE(SUM(cs.unique_opens), 0) AS unique_opens,
		       COALESCE(SUM(cs.unique_clicks), 0) AS unique_clicks
		FROM campaign_stats cs
		JOIN campaigns c ON c.id = cs.campaign_id
		WHERE c.workspace_id = ? AND c.type <> 'test'`,
		workspaceID, workspaceID, workspaceID)
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
