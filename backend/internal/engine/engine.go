package engine

import (
	"context"
	"database/sql"
	"fmt"
	"html"
	"log"
	"strings"
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
		_ = e.notify(ctx, campaign.WorkspaceID, "campaign-failed",
			"Campaign failed to start",
			"Your campaign \""+campaign.Name+"\" could not start because its audience could not be resolved.",
			"/campaigns/"+campaign.ID)
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
		from = "onboarding@resend.dev"
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
	done, err := e.store.CompleteCampaignIfDone(ctx, campaign.ID)
	if err != nil {
		return err
	}
	if done {
		_ = e.notify(ctx, campaign.WorkspaceID, "campaign-sent",
			"Campaign finished sending",
			"Your campaign \""+campaign.Name+"\" finished sending.",
			"/campaigns/"+campaign.ID)
	}
	return nil
}

func (e *Engine) notify(ctx context.Context, workspaceID, typ, title, body, link string) error {
	userID, err := e.store.WorkspaceOwnerUserID(ctx, workspaceID)
	if err != nil {
		return err
	}
	return e.store.CreateNotification(ctx, &store.Notification{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		UserID:      userID,
		Type:        typ,
		Title:       title,
		Body:        body,
		Link:        link,
	})
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
		from = "onboarding@resend.dev"
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

// SendOneToOne sends a single email to a contact, using the workspace sender
// defaults. Contact variables are substituted in subject and body.
func (e *Engine) SendOneToOne(ctx context.Context, ws *store.Workspace, contact *store.Contact, subject, body string) (*sender.SendResult, error) {
	vars := contactVariables(contact)
	htmlBody := textToHTML(Substitute(body, vars))

	from := ws.FromEmail
	if from == "" {
		from = "onboarding@resend.dev"
	}
	if ws.FromName != "" {
		from = ws.FromName + " <" + from + ">"
	}

	return e.sender.Send(ctx, sender.Message{
		From:    from,
		To:      contact.Email,
		Subject: Substitute(subject, vars),
		HTML:    htmlBody,
		Text:    Substitute(body, vars),
		ReplyTo: ws.ReplyTo,
		Headers: map[string]string{
			"X-Mailgeko-Workspace": ws.ID,
			"X-Mailgeko-Contact":   contact.ID,
			"X-Mailgeko-Single":    "1",
		},
		Tags: []sender.Tag{
			{Name: "single", Value: "1"},
		},
	})
}

// SendMemberEmail sends a short transactional email (invite reminder or
// check-in) to a member of the workspace, from the workspace sender defaults.
func (e *Engine) SendMemberEmail(ctx context.Context, ws *store.Workspace, to, subject, body string) (*sender.SendResult, error) {
	from := ws.FromEmail
	if from == "" {
		from = "onboarding@resend.dev"
	}
	if ws.FromName != "" {
		from = ws.FromName + " <" + from + ">"
	}
	return e.sender.Send(ctx, sender.Message{
		From:    from,
		To:      to,
		Subject: subject,
		HTML:    renderTransactionalHTML(body, e.baseURL),
		Text:    body,
		ReplyTo: ws.ReplyTo,
		Headers: map[string]string{"X-Mailgeko-Workspace": ws.ID},
		Tags:    []sender.Tag{{Name: "type", Value: "member"}},
	})
}

// SendEmailVerification emails a link that confirms the user's email address.
func (e *Engine) SendEmailVerification(ctx context.Context, to, name, link string) (*sender.SendResult, error) {
	body := fmt.Sprintf(
		"Hi %s,<br/><br/>Please confirm your email address by clicking the button below.<br/><br/><a href=\"%s\" style=\"display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:8px\">Confirm my email</a><br/><br/>If you didn't create an account with Mailgeko, you can safely ignore this email.",
		html.EscapeString(name), link)
	return e.sender.Send(ctx, sender.Message{
		From:    "Mailgeko <onboarding@resend.dev>",
		To:      to,
		Subject: "Confirm your email address",
		HTML:    renderTransactionalHTML(body, e.baseURL),
		Text:    "Hi " + name + ",\n\nConfirm your email address by opening this link:\n" + link + "\n\nIf you didn't create an account with Mailgeko, you can safely ignore this email.",
		Tags:    []sender.Tag{{Name: "type", Value: "verify"}},
	})
}

// SendPasswordReset emails a link that lets the user choose a new password.
func (e *Engine) SendPasswordReset(ctx context.Context, to, name, link string) (*sender.SendResult, error) {
	body := fmt.Sprintf(
		"Hi %s,<br/><br/>We received a request to reset your Mailgeko password. Click the button below to choose a new one.<br/><br/><a href=\"%s\" style=\"display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:8px\">Reset my password</a><br/><br/>This link expires in 30 minutes. If you didn't request a reset, you can safely ignore this email.",
		html.EscapeString(name), link)
	return e.sender.Send(ctx, sender.Message{
		From:    "Mailgeko <onboarding@resend.dev>",
		To:      to,
		Subject: "Reset your Mailgeko password",
		HTML:    renderTransactionalHTML(body, e.baseURL),
		Text:    "Hi " + name + ",\n\nReset your Mailgeko password by opening this link:\n" + link + "\n\nThis link expires in 30 minutes. If you didn't request a reset, you can safely ignore this email.",
		Tags:    []sender.Tag{{Name: "type", Value: "reset"}},
	})
}

// renderTransactionalHTML wraps a plain-text message in a minimal branded
// email with a sign-in button.
func renderTransactionalHTML(body, baseURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f6f7f9">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
    <div style="font-size:18px;font-weight:600;color:#111827;margin-bottom:16px">Mailgeko</div>
    <div style="color:#374151;font-size:15px;line-height:1.6">%s</div>
    <p style="margin:24px 0 0">
      <a href="%s/login" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:8px">Sign in to Mailgeko</a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">You received this email as a member of a Mailgeko workspace.</p>
  </div>
</div>
</body>
</html>`, body, baseURL)
}

// textToHTML escapes plain text and wraps blank-line-separated blocks in <p>.
func textToHTML(s string) string {
	if strings.TrimSpace(s) == "" {
		return ""
	}
	escaped := html.EscapeString(s)
	blocks := strings.Split(escaped, "\n\n")
	var out strings.Builder
	for i, block := range blocks {
		if i > 0 {
			out.WriteString("\n")
		}
		out.WriteString("<p>")
		out.WriteString(strings.ReplaceAll(block, "\n", "<br>"))
		out.WriteString("</p>")
	}
	return out.String()
}

func now() time.Time {
	return time.Now().UTC()
}
