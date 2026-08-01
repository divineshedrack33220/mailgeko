package engine

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/divineshedrack33220/mailgeko/backend/internal/embed"
	"github.com/divineshedrack33220/mailgeko/backend/internal/sender"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
	"github.com/divineshedrack33220/mailgeko/backend/internal/vector"
)

type Queue interface {
	EnqueueRecipientSend(ctx context.Context, campaignID, contactID string) error
}

type EventInput struct {
	WorkspaceID string
	CampaignID  string
	ContactID   string
	Type        string
	URL         string
}

type Engine struct {
	store    *store.Store
	sender   *sender.Client
	queue    Queue
	baseURL  string
	embeds   *vector.Store
	embedder embed.Embedder
}

func New(db *store.Store, sender *sender.Client, queue Queue, baseURL string) *Engine {
	return &Engine{store: db, sender: sender, queue: queue, baseURL: baseURL}
}

// WithEmbedding enables pgvector contact search. Both the vector store and the
// embedder must be non-nil for search endpoints to be served.
func (e *Engine) WithEmbedding(embeds *vector.Store, embedder embed.Embedder) *Engine {
	e.embeds = embeds
	e.embedder = embedder
	return e
}

func (e *Engine) StartCampaign(ctx context.Context, campaignID string) error {
	campaign, err := e.store.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return err
	}

	if err := e.store.SetCampaignStatus(ctx, campaign.WorkspaceID, campaign.ID, store.CampaignSending); err != nil {
		return err
	}
	if err := e.store.EnsureCampaignStats(ctx, campaign.ID); err != nil {
		return err
	}

	ids, err := e.resolveRecipients(ctx, campaign)
	if err != nil {
		return err
	}

	inserted := 0
	for _, contactID := range ids {
		if err := e.store.UpsertCampaignRecipient(ctx, &store.CampaignRecipient{
			CampaignID: campaign.ID,
			ContactID:  contactID,
			Status:     "queued",
		}); err != nil {
			return err
		}
		inserted++
	}

	if err := e.store.SetCampaignStatsField(ctx, campaign.ID, "recipients", int64(inserted)); err != nil {
		return err
	}

	for _, contactID := range ids {
		if err := e.queue.EnqueueRecipientSend(ctx, campaign.ID, contactID); err != nil {
			log.Printf("engine: enqueue recipient %s: %v", contactID, err)
		}
	}
	return nil
}

func (e *Engine) resolveRecipients(ctx context.Context, campaign *store.Campaign) ([]string, error) {
	seen := make(map[string]bool)
	var out []string

	add := func(contactID string) {
		if contactID == "" || seen[contactID] {
			return
		}
		seen[contactID] = true
		out = append(out, contactID)
	}

	for _, listID := range campaign.ListIDs {
		ids, err := e.store.ListContactIDs(ctx, listID)
		if err != nil {
			return nil, err
		}
		for _, id := range ids {
			add(id)
		}
	}

	if len(campaign.SegmentIDs) > 0 {
		contacts, err := e.store.AllContacts(ctx, campaign.WorkspaceID)
		if err != nil {
			return nil, err
		}
		for _, segID := range campaign.SegmentIDs {
			seg, err := e.store.GetSegment(ctx, campaign.WorkspaceID, segID)
			if err != nil {
				continue
			}
			for _, c := range contacts {
				if segmentMatches(seg, c) {
					add(c.ID)
				}
			}
		}
	}

	return out, nil
}

func (e *Engine) SendToRecipient(ctx context.Context, campaignID, contactID string) error {
	campaign, err := e.store.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return err
	}
	contact, err := e.store.GetContactByID(ctx, contactID)
	if err != nil {
		return err
	}

	if contact.Status == store.ContactUnsubscribed || contact.Status == store.ContactBounced || contact.Status == store.ContactSpam {
		_ = e.store.MarkRecipientSkipped(ctx, campaignID, contactID)
		return e.maybeCompleteCampaign(ctx, campaign)
	}

	body := campaign.HTMLContent
	if body == "" && campaign.TemplateID != "" {
		tpl, err := e.store.GetTemplate(ctx, campaign.WorkspaceID, campaign.TemplateID)
		if err == nil {
			body = tpl.HTML
		}
	}
	if body == "" {
		body = "<p>" + campaign.PlainText + "</p>"
	}
	if body == "" {
		return nil
	}

	html := RenderHTML(body, contactVariables(contact), RenderOptions{
		BaseURL:          e.baseURL,
		TrackOpens:       campaign.TrackOpens,
		TrackClicks:      campaign.TrackClicks,
		AllowUnsubscribe: campaign.AllowUnsubscribe,
		CampaignID:       campaign.ID,
		ContactID:        contact.ID,
	})

	from := campaign.FromEmail
	if from == "" {
		from = "team@mailgeko.dev"
	}
	fromName := campaign.FromName
	if fromName != "" {
		from = fromName + " <" + from + ">"
	}

	result, err := e.sender.Send(ctx, sender.Message{
		From:    from,
		To:      contact.Email,
		Subject: Substitute(campaign.Subject, contactVariables(contact)),
		HTML:    html,
		Text:    campaign.PlainText,
		ReplyTo: campaign.ReplyTo,
		Headers: map[string]string{
			"X-Mailgeko-Campaign":  campaign.ID,
			"X-Mailgeko-Contact":   contact.ID,
			"X-Mailgeko-Workspace": campaign.WorkspaceID,
		},
		Tags: []sender.Tag{
			{Name: "campaign", Value: campaign.ID},
		},
	})
	if err != nil {
		_ = e.store.MarkRecipientFailed(ctx, campaign.ID, contact.ID, err.Error())
		_ = e.maybeCompleteCampaign(ctx, campaign)
		return err
	}

	if err := e.store.MarkRecipientSent(ctx, campaign.ID, contact.ID, result.MessageID); err != nil {
		return err
	}
	if err := e.store.SetCampaignStatsField(ctx, campaign.ID, "sent", 1); err != nil {
		return err
	}
	if campaign.TemplateID != "" {
		_ = e.store.IncrementTemplateUsed(ctx, campaign.WorkspaceID, campaign.TemplateID)
	}
	return e.maybeCompleteCampaign(ctx, campaign)
}

func (e *Engine) maybeCompleteCampaign(ctx context.Context, campaign *store.Campaign) error {
	if err := e.store.CompleteCampaignIfDone(ctx, campaign.ID); err != nil {
		return err
	}
	return nil
}

func (e *Engine) RecordEvent(ctx context.Context, in EventInput) error {
	switch in.Type {
	case "delivered":
		if err := e.store.MarkRecipientDelivered(ctx, in.CampaignID, in.ContactID); err != nil {
			return err
		}
		_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "delivered", 1)
	case "opened":
		first, err := e.store.MarkRecipientOpened(ctx, in.CampaignID, in.ContactID)
		if err != nil {
			return err
		}
		_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "opened", 1)
		if first {
			_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "unique_opens", 1)
		}
		_ = e.store.MarkContactEngagement(ctx, in.WorkspaceID, in.ContactID, now())
	case "clicked":
		first, err := e.store.MarkRecipientClicked(ctx, in.CampaignID, in.ContactID)
		if err != nil {
			return err
		}
		_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "clicked", 1)
		if first {
			_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "unique_clicks", 1)
		}
		_ = e.store.MarkContactEngagement(ctx, in.WorkspaceID, in.ContactID, now())
	case "bounced":
		_ = e.store.MarkRecipientBounced(ctx, in.CampaignID, in.ContactID, in.URL)
		_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "bounced", 1)
		_ = e.store.UpdateContactStatus(ctx, in.WorkspaceID, in.ContactID, store.ContactBounced)
	case "complained":
		_ = e.store.MarkRecipientComplained(ctx, in.CampaignID, in.ContactID)
		_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "complained", 1)
		_ = e.store.UpdateContactStatus(ctx, in.WorkspaceID, in.ContactID, store.ContactSpam)
	case "unsubscribed":
		_ = e.store.MarkRecipientUnsubscribed(ctx, in.CampaignID, in.ContactID)
		_ = e.store.SetCampaignStatsField(ctx, in.CampaignID, "unsubscribed", 1)
		_ = e.store.UpdateContactStatus(ctx, in.WorkspaceID, in.ContactID, store.ContactUnsubscribed)
	}
	return nil
}

func (e *Engine) NewEventFromHeaders(workspaceID, campaignID, contactID string, eventType string, url string) EventInput {
	return EventInput{
		WorkspaceID: workspaceID,
		CampaignID:  campaignID,
		ContactID:   contactID,
		Type:        eventType,
		URL:         url,
	}
}

func (e *Engine) ResolveCampaignByMessageID(ctx context.Context, messageID string) (*store.Campaign, *store.Contact, error) {
	if messageID == "" {
		return nil, nil, sql.ErrNoRows
	}
	campaignID, contactID, err := e.store.CampaignContactByMessageID(ctx, messageID)
	if err != nil {
		return nil, nil, err
	}
	campaign, err := e.store.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return nil, nil, err
	}
	contact, err := e.store.GetContactByID(ctx, contactID)
	if err != nil {
		return nil, nil, err
	}
	return campaign, contact, nil
}

func (e *Engine) SendTestEmail(ctx context.Context, c *store.Campaign, to string) error {
	body := c.HTMLContent
	if body == "" && c.TemplateID != "" {
		if tpl, err := e.store.GetTemplate(ctx, c.WorkspaceID, c.TemplateID); err == nil {
			body = tpl.HTML
		}
	}
	if body == "" {
		body = "<p>" + c.PlainText + "</p>"
	}

	vars := map[string]string{
		"first_name": "Test",
		"last_name":  "User",
		"email":      to,
		"company":    "Acme Inc.",
		"position":   "Manager",
		"country":    "United States",
		"city":       "San Francisco",
		"phone":      "+1 555 0100",
	}

	html := RenderHTML(body, vars, RenderOptions{
		BaseURL:          e.baseURL,
		TrackOpens:       c.TrackOpens,
		TrackClicks:      c.TrackClicks,
		AllowUnsubscribe: c.AllowUnsubscribe,
		CampaignID:       c.ID,
		ContactID:        "test",
	})

	from := c.FromEmail
	if from == "" {
		from = "team@mailgeko.dev"
	}
	if c.FromName != "" {
		from = c.FromName + " <" + from + ">"
	}

	_, err := e.sender.Send(ctx, sender.Message{
		From:    from,
		To:      to,
		Subject: Substitute(c.Subject, vars),
		HTML:    html,
		Text:    c.PlainText,
		ReplyTo: c.ReplyTo,
	})
	return err
}

func NewID() string {
	return uuid.NewString()
}

func now() time.Time {
	return time.Now().UTC()
}
