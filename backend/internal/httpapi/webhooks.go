package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
)

type resendWebhookRequest struct {
	Type string `json:"type"`
	Data struct {
		EmailID string `json:"email_id"`
		To      string `json:"to"`
		Headers []struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"headers"`
		Timestamp time.Time `json:"created_at"`
		URL       string    `json:"url"`
		Reason    string    `json:"reason"`
	} `json:"data"`
}

var resendEventMap = map[string]string{
	"email.sent":         "sent",
	"email.delivered":    "delivered",
	"email.opened":       "opened",
	"email.clicked":      "clicked",
	"email.bounced":      "bounced",
	"email.complained":   "complained",
	"email.unsubscribed": "unsubscribed",
}

func (s *Server) handleResendWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "could not read body")
		return
	}

	// Resend may batch events in an array.
	var events []resendWebhookRequest
	if len(body) > 0 && body[0] == '[' {
		if err := json.Unmarshal(body, &events); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
			return
		}
	} else {
		var single resendWebhookRequest
		if err := json.Unmarshal(body, &single); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
			return
		}
		events = []resendWebhookRequest{single}
	}

	handled := 0
	for _, ev := range events {
		if s.handleResendEvent(r, ev) {
			handled++
		}
	}
	writeOK(w, map[string]any{"ok": true, "handled": handled})
}

func (s *Server) handleResendEvent(r *http.Request, ev resendWebhookRequest) bool {
	eventType, ok := resendEventMap[ev.Type]
	if !ok {
		return false
	}

	var campaignID, contactID, workspaceID string
	for _, h := range ev.Data.Headers {
		switch strings.ToLower(h.Name) {
		case "x-mailgeko-campaign":
			campaignID = h.Value
		case "x-mailgeko-contact":
			contactID = h.Value
		case "x-mailgeko-workspace":
			workspaceID = h.Value
		}
	}

	if campaignID == "" && ev.Data.EmailID != "" && s.db != nil {
		cpID, ctID, err := s.db.CampaignContactByMessageID(r.Context(), ev.Data.EmailID)
		if err == nil {
			campaignID, contactID = cpID, ctID
		}
	}
	if campaignID == "" {
		return false
	}
	if workspaceID == "" && s.db != nil {
		if c, err := s.db.GetCampaignByID(r.Context(), campaignID); err == nil {
			workspaceID = c.WorkspaceID
		}
	}

	event := engine.EventInput{
		WorkspaceID: workspaceID,
		CampaignID:  campaignID,
		ContactID:   contactID,
		Type:        eventType,
		URL:         ev.Data.URL,
	}
	_ = s.queue.EnqueueRecordEvent(r.Context(), queueRecordEventPayload{
		WorkspaceID: event.WorkspaceID,
		CampaignID:  event.CampaignID,
		ContactID:   event.ContactID,
		Type:        event.Type,
		URL:         event.URL,
	})
	return true
}

func (s *Server) handleCampaignAnalytics(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	campaignID := r.PathValue("id")
	if _, err := s.db.GetCampaign(r.Context(), claims.GetWorkspaceID(), campaignID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	stats, err := s.db.GetCampaignStats(r.Context(), campaignID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load analytics")
		return
	}

	recipients, _ := s.db.CountRecipients(r.Context(), campaignID)
	if recipients > stats.Recipients {
		stats.Recipients = recipients
	}

	writeOK(w, map[string]any{
		"campaignId": campaignID,
		"stats": map[string]any{
			"recipients":   stats.Recipients,
			"sent":         stats.Sent,
			"delivered":    stats.Delivered,
			"opened":       stats.Opened,
			"clicked":      stats.Clicked,
			"bounced":      stats.Bounced,
			"complained":   stats.Complained,
			"unsubscribed": stats.Unsubscribed,
			"uniqueOpens":  stats.UniqueOpens,
			"uniqueClicks": stats.UniqueClicks,
		},
		"openRate":   pct(stats.UniqueOpens, stats.Delivered),
		"clickRate":  pct(stats.UniqueClicks, stats.Delivered),
		"bounceRate": pct(stats.Bounced, stats.Sent),
	})
}
