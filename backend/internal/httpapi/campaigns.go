package httpapi

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type campaignRequest struct {
	Name        string     `json:"name"`
	Subject     string     `json:"subject"`
	TemplateID  string     `json:"templateId"`
	PreviewText string     `json:"previewText"`
	PlainText   string     `json:"plainText"`
	HTMLContent string     `json:"htmlContent"`
	Status      string     `json:"status"`
	Type        string     `json:"type"`
	ListIDs     []string   `json:"listIds"`
	SegmentIDs  []string   `json:"segmentIds"`
	ScheduleAt  *time.Time `json:"scheduleAt"`
	Sender      struct {
		FromName  string `json:"fromName"`
		FromEmail string `json:"fromEmail"`
		ReplyTo   string `json:"replyTo"`
	} `json:"sender"`
	Settings struct {
		TrackOpens       *bool `json:"trackOpens"`
		TrackClicks      *bool `json:"trackClicks"`
		AllowUnsubscribe *bool `json:"allowUnsubscribe"`
	} `json:"settings"`
}

func (r *campaignRequest) apply(c *store.Campaign) {
	if r.Name != "" {
		c.Name = r.Name
	}
	if r.Subject != "" {
		c.Subject = r.Subject
	}
	if r.TemplateID != "" {
		c.TemplateID = r.TemplateID
	}
	if r.PreviewText != "" {
		c.PreviewText = r.PreviewText
	}
	if r.PlainText != "" {
		c.PlainText = r.PlainText
	}
	if r.HTMLContent != "" {
		c.HTMLContent = r.HTMLContent
	}
	if r.Status != "" {
		allowedStatuses := map[string]bool{
			"draft": true, "scheduled": true, "sending": true,
			"sent": true, "completed": true, "failed": true, "paused": true,
		}
		if allowedStatuses[r.Status] {
			c.Status = r.Status
		}
	}
	if r.Type != "" {
		c.Type = r.Type
	}
	if r.ListIDs != nil {
		c.ListIDs = r.ListIDs
	}
	if r.SegmentIDs != nil {
		c.SegmentIDs = r.SegmentIDs
	}
	if r.ScheduleAt != nil {
		c.ScheduleAt = r.ScheduleAt
	}
	if r.Sender.FromName != "" {
		c.FromName = r.Sender.FromName
	}
	if r.Sender.FromEmail != "" {
		c.FromEmail = r.Sender.FromEmail
	}
	if r.Sender.ReplyTo != "" {
		c.ReplyTo = r.Sender.ReplyTo
	}
	if r.Settings.TrackOpens != nil {
		c.TrackOpens = *r.Settings.TrackOpens
	}
	if r.Settings.TrackClicks != nil {
		c.TrackClicks = *r.Settings.TrackClicks
	}
	if r.Settings.AllowUnsubscribe != nil {
		c.AllowUnsubscribe = *r.Settings.AllowUnsubscribe
	}
}

func campaignResponse(c *store.Campaign, stats *store.CampaignStats, recipientCount int64) map[string]any {
	if stats == nil {
		stats = &store.CampaignStats{CampaignID: c.ID}
	}
	recipients := stats.Recipients
	sent := stats.Sent
	if c.Type == "automated" {
		if recipientCount > 0 {
			recipients = recipientCount
			sent = recipientCount
		}
	} else {
		// Regular campaigns never write automation sends to campaign_stats;
		// they live in campaign_recipients with an automation_run_id. Pad so
		// the card matches billing/workspace totals.
		recipients += stats.AutoRecipients
		sent += stats.AutoSent
	}
	var scheduleAt any
	if c.ScheduleAt != nil {
		scheduleAt = c.ScheduleAt.UTC().Format(time.RFC3339)
	}
	return map[string]any{
		"id":          c.ID,
		"name":        c.Name,
		"subject":     c.Subject,
		"templateId":  c.TemplateID,
		"previewText": c.PreviewText,
		"plainText":   c.PlainText,
		"htmlContent": c.HTMLContent,
		"status":      c.Status,
		"type":        c.Type,
		"listIds":     orEmptySlice(c.ListIDs),
		"segmentIds":  orEmptySlice(c.SegmentIDs),
		"scheduleAt":  scheduleAt,
		"sender": map[string]any{
			"fromName":  c.FromName,
			"fromEmail": c.FromEmail,
			"replyTo":   c.ReplyTo,
		},
		"settings": map[string]any{
			"trackOpens":       c.TrackOpens,
			"trackClicks":      c.TrackClicks,
			"allowUnsubscribe": c.AllowUnsubscribe,
		},
		"stats": map[string]any{
			"recipients":   recipients,
			"sent":         sent,
			"delivered":    stats.Delivered,
			"opened":       stats.Opened,
			"clicked":      stats.Clicked,
			"bounced":      stats.Bounced,
			"complained":   stats.Complained,
			"unsubscribed": stats.Unsubscribed,
			"uniqueOpens":  stats.UniqueOpens,
			"uniqueClicks": stats.UniqueClicks,
		},
		"createdAt": c.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt": c.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func (s *Server) handleListCampaigns(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	campaigns, err := s.db.ListCampaigns(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list campaigns")
		return
	}
	out := make([]map[string]any, 0, len(campaigns))
	for _, c := range campaigns {
		stats, _ := s.db.GetCampaignStats(r.Context(), c.ID)
		var count int64
		if c.Type == "automated" {
			count, _ = s.db.CountRecipients(r.Context(), c.ID)
		}
		out = append(out, campaignResponse(c, stats, count))
	}
	writeOK(w, map[string]any{"campaigns": out})
}

func (s *Server) handleCreateCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	var req campaignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	c := &store.Campaign{
		ID:               newID(),
		WorkspaceID:      claims.GetWorkspaceID(),
		Status:           store.CampaignDraft,
		Type:             "regular",
		TrackOpens:       true,
		TrackClicks:      true,
		AllowUnsubscribe: true,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	req.apply(c)
	if strings.TrimSpace(c.Name) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	if c.FromName == "" || c.FromEmail == "" || c.ReplyTo == "" {
		if ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID()); err == nil {
			if c.FromName == "" {
				c.FromName = ws.FromName
			}
			if c.FromEmail == "" {
				c.FromEmail = ws.FromEmail
			}
			if c.ReplyTo == "" {
				c.ReplyTo = ws.ReplyTo
			}
		}
	}
	if err := s.db.CreateCampaign(r.Context(), c); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create campaign")
		return
	}
	if err := s.db.EnsureCampaignStats(r.Context(), c.ID); err != nil {
		_ = s.db.DeleteCampaign(r.Context(), c.WorkspaceID, c.ID)
		writeError(w, http.StatusInternalServerError, "internal", "could not create campaign")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"campaign": campaignResponse(c, nil, 0)})
}

func (s *Server) handleGetCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	c, err := s.db.GetCampaign(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "campaign not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load campaign")
		return
	}
	stats, _ := s.db.GetCampaignStats(r.Context(), c.ID)
	var count int64
	if c.Type == "automated" {
		count, _ = s.db.CountRecipients(r.Context(), c.ID)
	}
	writeOK(w, map[string]any{"campaign": campaignResponse(c, stats, count)})
}

func (s *Server) handleUpdateCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	id := r.PathValue("id")
	existing, err := s.db.GetCampaign(r.Context(), claims.GetWorkspaceID(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "campaign not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load campaign")
		return
	}
	var req campaignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.apply(existing)
	if err := s.db.UpdateCampaign(r.Context(), existing); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update campaign")
		return
	}
	writeOK(w, map[string]any{"campaign": campaignResponse(existing, nil, 0)})
}

func (s *Server) handleDeleteCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	if err := s.db.DeleteCampaign(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete campaign")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleSendCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	c, err := s.db.GetCampaign(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "campaign not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load campaign")
		return
	}
	if c.Status != store.CampaignDraft && c.Status != store.CampaignScheduled && c.Status != store.CampaignPaused && c.Status != store.CampaignFailed {
		writeError(w, http.StatusConflict, "invalid_state", "campaign cannot be sent from its current state")
		return
	}
	if s.biller != nil {
		recipients, err := s.db.CountRecipients(r.Context(), c.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not count recipients")
			return
		}
		if err := s.biller.CheckEmailQuota(r.Context(), claims.GetWorkspaceID(), recipients); err != nil {
			s.writePlanError(w, err)
			return
		}
	}
	if err := s.db.SetCampaignStatus(r.Context(), claims.GetWorkspaceID(), c.ID, store.CampaignSending); err != nil {
		writeError(w, http.StatusConflict, "invalid_state", "campaign is already being sent")
		return
	}
	if err := s.queue.EnqueueCampaignSend(r.Context(), c.ID); err != nil {
		_ = s.db.SetCampaignStatus(r.Context(), claims.GetWorkspaceID(), c.ID, c.Status)
		writeError(w, http.StatusInternalServerError, "internal", "could not queue campaign")
		return
	}
	writeOK(w, map[string]any{"queued": true, "campaignId": c.ID})
}

type sendTestRequest struct {
	Emails []string `json:"emails"`
}

// handleListCampaignRecipients returns the per-recipient delivery breakdown
// for a campaign: who was queued, sent, delivered, opened, clicked, bounced,
// complained, unsubscribed, skipped or failed (with the error).
func (s *Server) handleListCampaignRecipients(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	c, err := s.db.GetCampaign(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "campaign not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load campaign")
		return
	}
	rows, err := s.db.ListCampaignRecipients(r.Context(), c.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load recipients")
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for _, rc := range rows {
		item := map[string]any{
			"contactId":       rc.ContactID,
			"email":           rc.Email,
			"firstName":       rc.FirstName,
			"lastName":        rc.LastName,
			"status":          rc.Status,
			"error":           rc.Error,
			"messageId":       rc.ResendMessageID,
			"automationRunId": rc.AutomationRunID,
			"sentAt":          nullTimeRFC3339(rc.SentAt),
			"deliveredAt":     nullTimeRFC3339(rc.DeliveredAt),
			"openedAt":        nullTimeRFC3339(rc.OpenedAt),
			"clickedAt":       nullTimeRFC3339(rc.ClickedAt),
			"bouncedAt":       nullTimeRFC3339(rc.BouncedAt),
			"complainedAt":    nullTimeRFC3339(rc.ComplainedAt),
			"unsubscribedAt":  nullTimeRFC3339(rc.UnsubscribedAt),
		}
		out = append(out, item)
	}
	writeOK(w, map[string]any{"recipients": out})
}

func (s *Server) handleSendTestCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	c, err := s.db.GetCampaign(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "campaign not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load campaign")
		return
	}
	var req sendTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if len(req.Emails) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "at least one email is required")
		return
	}
	validEmails := make([]string, 0, len(req.Emails))
	for _, email := range req.Emails {
		email = strings.TrimSpace(email)
		if email != "" && strings.Contains(email, "@") && strings.Contains(email, ".") {
			validEmails = append(validEmails, email)
		}
	}
	if len(validEmails) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "no valid email addresses provided")
		return
	}
	if s.engine == nil {
		writeError(w, http.StatusInternalServerError, "internal", "sending is not configured")
		return
	}
	for _, email := range validEmails {
		if err := s.engine.SendTestEmail(r.Context(), c, email); err != nil {
			log.Printf("campaigns: send test to %s: %v", email, err)
			writeError(w, http.StatusInternalServerError, "internal", "could not send test email")
			return
		}
	}
	writeOK(w, map[string]any{"sent": true})
}

func (s *Server) handleCancelCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	c, err := s.db.GetCampaign(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "campaign not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load campaign")
		return
	}
	if c.Status == store.CampaignSending {
		writeError(w, http.StatusConflict, "invalid_state", "campaign is already sending")
		return
	}
	if err := s.db.SetCampaignStatus(r.Context(), claims.GetWorkspaceID(), c.ID, store.CampaignDraft); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not cancel campaign")
		return
	}
	writeOK(w, map[string]any{"ok": true})
}
