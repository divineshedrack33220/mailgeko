package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type CampaignRecipient struct {
	CampaignID      string
	ContactID       string
	ResendMessageID string
	Status          string
	Error           string
	AutomationRunID string
	SentAt          *time.Time
	DeliveredAt     *time.Time
	OpenedAt        *time.Time
	ClickedAt       *time.Time
	BouncedAt       *time.Time
	ComplainedAt    *time.Time
	UnsubscribedAt  *time.Time
}

func (s *Store) UpsertCampaignRecipient(ctx context.Context, r *CampaignRecipient) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO campaign_recipients (campaign_id, contact_id, resend_message_id, status, error)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			resend_message_id = IF(resend_message_id IS NULL OR resend_message_id = '', VALUES(resend_message_id), resend_message_id),
			status = IF(status IN ('queued', 'failed', 'skipped'), VALUES(status), status),
			error = IF(status IN ('queued', 'failed', 'skipped'), VALUES(error), error)`,
		r.CampaignID, r.ContactID, r.ResendMessageID, r.Status, r.Error)
	return err
}

func (s *Store) SetRecipientMessageID(ctx context.Context, campaignID, contactID, messageID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET resend_message_id = ? WHERE campaign_id = ? AND contact_id = ?`,
		messageID, campaignID, contactID)
	return err
}

// MarkAutomationSent records that an automation run sent a campaign to a
// contact. The row doubles as the engagement record and as the idempotency
// marker used to avoid re-sending on a retried step.
func (s *Store) MarkAutomationSent(ctx context.Context, r *CampaignRecipient) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO campaign_recipients (campaign_id, contact_id, resend_message_id, status, error, automation_run_id, sent_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			resend_message_id = VALUES(resend_message_id),
			status = VALUES(status),
			error = VALUES(error),
			automation_run_id = VALUES(automation_run_id),
			sent_at = VALUES(sent_at)`,
		r.CampaignID, r.ContactID, r.ResendMessageID, r.Status, r.Error, r.AutomationRunID, r.SentAt)
	return err
}

// RecipientSentByAutomation reports whether the given automation run already
// sent this campaign to the contact, so a retried send-email step does not
// email them twice.
func (s *Store) RecipientSentByAutomation(ctx context.Context, campaignID, contactID, automationRunID string) (bool, error) {
	var n int
	err := s.db.GetContext(ctx, &n, `
		SELECT COUNT(*) FROM campaign_recipients
		WHERE campaign_id = ? AND contact_id = ? AND automation_run_id = ? AND status = 'sent'`,
		campaignID, contactID, automationRunID)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (s *Store) MarkRecipientSent(ctx context.Context, campaignID, contactID, messageID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET resend_message_id = ?, status = 'sent', error = '', sent_at = ?
		 WHERE campaign_id = ? AND contact_id = ?`,
		messageID, time.Now().UTC(), campaignID, contactID)
	return err
}

// RecipientAlreadySent reports whether a campaign recipient has already been
// sent (or is in a terminal state like bounced/complained/unsubscribed). Used
// as an idempotency guard to prevent duplicate sends on worker retries.
func (s *Store) RecipientAlreadySent(ctx context.Context, campaignID, contactID string) (bool, error) {
	var status string
	err := s.db.GetContext(ctx, &status,
		`SELECT status FROM campaign_recipients WHERE campaign_id = ? AND contact_id = ?`,
		campaignID, contactID)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return status == "sent" || status == "bounced" || status == "complained" || status == "unsubscribed", nil
}

func (s *Store) MarkRecipientFailed(ctx context.Context, campaignID, contactID, errMsg string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET status = 'failed', error = ?
		 WHERE campaign_id = ? AND contact_id = ?`,
		errMsg, campaignID, contactID)
	return err
}

func (s *Store) MarkRecipientSkipped(ctx context.Context, campaignID, contactID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET status = 'skipped', error = ''
		 WHERE campaign_id = ? AND contact_id = ?`,
		campaignID, contactID)
	return err
}

func (s *Store) CompleteCampaignIfDone(ctx context.Context, campaignID string) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE campaigns SET status = 'sent', updated_at = ?
		 WHERE id = ? AND status = 'sending'
		   AND NOT EXISTS (
		     SELECT 1 FROM campaign_recipients
		     WHERE campaign_id = ? AND status = 'queued'
		   )`,
		time.Now().UTC(), campaignID, campaignID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if n != 1 {
		return false, err
	}

	// If no recipient actually got sent (every one failed or was skipped),
	// mark the campaign failed instead of sent so the UI reflects reality.
	var sent, failed int64
	if err := s.db.GetContext(ctx, &sent,
		`SELECT COUNT(*) FROM campaign_recipients
		 WHERE campaign_id = ?
		   AND (status = 'sent' OR status IN ('bounced','complained','unsubscribed')
		        OR delivered_at IS NOT NULL OR opened_at IS NOT NULL OR clicked_at IS NOT NULL)`,
		campaignID); err != nil {
		return true, err
	}
	if sent > 0 {
		return true, nil
	}
	if err := s.db.GetContext(ctx, &failed,
		`SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ? AND status = 'failed'`,
		campaignID); err != nil {
		return true, err
	}
	if failed > 0 {
		_, err = s.db.ExecContext(ctx,
			`UPDATE campaigns SET status = 'failed', updated_at = ? WHERE id = ?`,
			time.Now().UTC(), campaignID)
	}
	return true, err
}

func (s *Store) firstOccurrence(ctx context.Context, campaignID, contactID, column string) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET `+column+` = ? WHERE campaign_id = ? AND contact_id = ? AND `+column+` IS NULL`,
		time.Now().UTC(), campaignID, contactID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// RecipientEngaged reports whether a contact opened or clicked the given
// campaign. Automation condition steps rely on this.
func (s *Store) RecipientEngaged(ctx context.Context, campaignID, contactID, kind string) (bool, error) {
	column := "opened_at"
	if kind == "clicked" {
		column = "clicked_at"
	}
	var at *time.Time
	err := s.db.GetContext(ctx, &at,
		`SELECT MAX(`+column+`) FROM campaign_recipients WHERE campaign_id = ? AND contact_id = ?`,
		campaignID, contactID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return at != nil, nil
}

func (s *Store) MarkRecipientDelivered(ctx context.Context, campaignID, contactID string) error {
	_, err := s.firstOccurrence(ctx, campaignID, contactID, "delivered_at")
	return err
}

func (s *Store) MarkRecipientOpened(ctx context.Context, campaignID, contactID string) (bool, error) {
	return s.firstOccurrence(ctx, campaignID, contactID, "opened_at")
}

func (s *Store) MarkRecipientClicked(ctx context.Context, campaignID, contactID string) (bool, error) {
	return s.firstOccurrence(ctx, campaignID, contactID, "clicked_at")
}

func (s *Store) MarkRecipientBounced(ctx context.Context, campaignID, contactID, reason string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET bounced_at = ?, status = 'bounced', error = ?
		 WHERE campaign_id = ? AND contact_id = ?`,
		time.Now().UTC(), reason, campaignID, contactID)
	return err
}

func (s *Store) MarkRecipientComplained(ctx context.Context, campaignID, contactID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET complained_at = ?, status = 'complained'
		 WHERE campaign_id = ? AND contact_id = ?`,
		time.Now().UTC(), campaignID, contactID)
	return err
}

func (s *Store) MarkRecipientUnsubscribed(ctx context.Context, campaignID, contactID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_recipients SET unsubscribed_at = ?, status = 'unsubscribed'
		 WHERE campaign_id = ? AND contact_id = ?`,
		time.Now().UTC(), campaignID, contactID)
	return err
}

func (s *Store) CampaignContactByMessageID(ctx context.Context, messageID string) (campaignID, contactID string, err error) {
	err = s.db.QueryRowContext(ctx,
		`SELECT campaign_id, contact_id FROM campaign_recipients WHERE resend_message_id = ? LIMIT 1`,
		messageID).Scan(&campaignID, &contactID)
	return
}

func (s *Store) CountRecipients(ctx context.Context, campaignID string) (int64, error) {
	var n int64
	err := s.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ?`, campaignID)
	return n, err
}

// CampaignRecipientWithContact pairs a recipient row with the contact it was
// sent to, so the API can surface who received what and why a send failed.
type CampaignRecipientWithContact struct {
	CampaignRecipient
	Email     string
	FirstName string
	LastName  string
}

// ListCampaignRecipients returns every recipient of a campaign together with
// the contact's email and name, newest sends first.
func (s *Store) ListCampaignRecipients(ctx context.Context, campaignID string) ([]CampaignRecipientWithContact, error) {
	rows, err := s.db.QueryxContext(ctx, `
		SELECT r.campaign_id, r.contact_id, r.resend_message_id, r.status, r.error,
		       r.automation_run_id, r.sent_at, r.delivered_at, r.opened_at,
		       r.clicked_at, r.bounced_at, r.complained_at, r.unsubscribed_at,
		       c.email, c.first_name, c.last_name
		FROM campaign_recipients r
		JOIN contacts c ON c.id = r.contact_id
		WHERE r.campaign_id = ?
		ORDER BY (r.status = 'queued') DESC, r.sent_at DESC, c.email ASC`, campaignID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CampaignRecipientWithContact
	for rows.Next() {
		var r CampaignRecipientWithContact
		var resendMessageID, statusErr, automationRunID sql.NullString
		var sentAt, deliveredAt, openedAt, clickedAt, bouncedAt, complainedAt, unsubscribedAt sql.NullTime
		if err := rows.Scan(
			&r.CampaignID, &r.ContactID, &resendMessageID, &r.Status, &statusErr,
			&automationRunID, &sentAt, &deliveredAt, &openedAt, &clickedAt, &bouncedAt, &complainedAt, &unsubscribedAt,
			&r.Email, &r.FirstName, &r.LastName,
		); err != nil {
			return nil, err
		}
		r.ResendMessageID = resendMessageID.String
		r.Error = statusErr.String
		r.AutomationRunID = automationRunID.String
		r.SentAt = nullTimePtr(sentAt)
		r.DeliveredAt = nullTimePtr(deliveredAt)
		r.OpenedAt = nullTimePtr(openedAt)
		r.ClickedAt = nullTimePtr(clickedAt)
		r.BouncedAt = nullTimePtr(bouncedAt)
		r.ComplainedAt = nullTimePtr(complainedAt)
		r.UnsubscribedAt = nullTimePtr(unsubscribedAt)
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) SetCampaignStatsField(ctx context.Context, campaignID, field string, delta int64) error {
	allowedFields := map[string]bool{
		"recipients": true, "sent": true, "delivered": true, "opened": true,
		"clicked": true, "bounced": true, "complained": true, "unsubscribed": true,
		"unique_opens": true, "unique_clicks": true,
	}
	if !allowedFields[field] {
		return fmt.Errorf("store: invalid campaign_stats field: %s", field)
	}
	_, err := s.db.ExecContext(ctx,
		`UPDATE campaign_stats SET `+field+` = `+field+` + ? WHERE campaign_id = ?`, delta, campaignID)
	return err
}
