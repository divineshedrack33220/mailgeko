package engine

import (
	"context"
	"database/sql"
	"fmt"
	"html"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/divineshedrack33220/mailgeko/backend/internal/crypto"
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
	store              *store.Store
	sender             *sender.Client
	queue              Queue
	baseURL            string
	trackingSecret     string
	defaultFromName    string
	defaultFromMail    string
	allowedFromDomains []string
	embeds             *vector.Store
	embedder           embed.Embedder
	enc                *crypto.Encryptor
	httpClient         *http.Client
}

func New(db *store.Store, sender *sender.Client, queue Queue, baseURL string) *Engine {
	return &Engine{
		store:      db,
		sender:     sender,
		queue:      queue,
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// WithTrackingSecret enables signed tracking links so engagement events can't
// be forged and tracking URLs can't be used as open redirects.
func (e *Engine) WithTrackingSecret(secret string) *Engine {
	e.trackingSecret = secret
	return e
}

// WithDefaultSender sets the from address used when no campaign or workspace
// sender is configured (transactional email, send tests, and empty senders).
func (e *Engine) WithDefaultSender(name, email string) *Engine {
	e.defaultFromName = name
	e.defaultFromMail = email
	return e
}

func (e *Engine) defaultFrom(name string) string {
	from := e.defaultFromMail
	if from == "" {
		from = "mailgeko@clawmark.online"
	}
	if name != "" {
		from = name + " <" + from + ">"
	} else if e.defaultFromName != "" {
		from = e.defaultFromName + " <" + from + ">"
	}
	return from
}

// WithAllowedFromDomains sets the sender domains verified with the email
// provider. A configured campaign/workspace sender whose domain is not in
// this list (e.g. a personal @gmail.com) is silently replaced by the default
// sender instead of being rejected by the provider with a 403.
func (e *Engine) WithAllowedFromDomains(domains ...string) *Engine {
	e.allowedFromDomains = domains
	return e
}

func (e *Engine) domainAllowed(email string) bool {
	if email == "" {
		return false
	}
	at := strings.LastIndex(email, "@")
	if at < 0 || at == len(email)-1 {
		return false
	}
	domain := strings.ToLower(email[at+1:])
	for _, d := range e.allowedFromDomains {
		if domain == strings.ToLower(d) {
			return true
		}
	}
	return false
}

// resolveFrom returns a sendable From address. It uses the configured
// campaign/workspace sender only when its domain is allowed; otherwise it
// falls back to the default verified sender.
func (e *Engine) resolveFrom(name, email string) string {
	if e.domainAllowed(email) {
		if name != "" {
			return name + " <" + email + ">"
		}
		return email
	}
	return e.defaultFrom("")
}

// WithEmbedding enables pgvector contact search. Both the vector store and the
// embedder must be non-nil for search endpoints to be served.
func (e *Engine) WithEmbedding(embeds *vector.Store, embedder embed.Embedder) *Engine {
	e.embeds = embeds
	e.embedder = embedder
	return e
}

// WithEncryptor enables per-workspace BYO-SMTP. Without it, all marketing mail
// is sent through the default Resend sender.
func (e *Engine) WithEncryptor(enc *crypto.Encryptor) *Engine {
	e.enc = enc
	return e
}

// Encryptor returns the secret encryptor (nil when BYO-SMTP is disabled).
func (e *Engine) Encryptor() *crypto.Encryptor {
	return e.enc
}

// emailSender is satisfied by both the Resend client and the SMTP client.
type emailSender interface {
	Send(ctx context.Context, msg sender.Message) (*sender.SendResult, error)
}

// resolveSender returns the sender to use for a workspace's marketing mail.
// When the workspace has an enabled SMTP config (and an encryptor is
// configured) it returns a per-workspace SMTP client, otherwise the default
// Resend client.
func (e *Engine) resolveSender(ctx context.Context, workspaceID string) (emailSender, error) {
	if e.enc == nil {
		return e.sender, nil
	}
	cfg, err := e.store.GetWorkspaceSMTP(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return e.sender, nil
		}
		return nil, err
	}
	if !cfg.Enabled {
		return e.sender, nil
	}
	plain, err := e.enc.Decrypt(cfg.PasswordCipher)
	if err != nil {
		return nil, fmt.Errorf("engine: decrypt smtp password: %w", err)
	}
	return sender.NewSMTPClient(sender.SMTPConfig{
		Host:      cfg.Host,
		Port:      cfg.Port,
		Username:  cfg.Username,
		Password:  string(plain),
		FromName:  cfg.FromName,
		FromEmail: cfg.FromEmail,
		ReplyTo:   cfg.ReplyTo,
	}), nil
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
		SigningKey:       e.trackingSecret,
	})

	snd, err := e.resolveSender(ctx, campaign.WorkspaceID)
	if err != nil {
		_ = e.store.MarkRecipientFailed(ctx, campaign.ID, contact.ID, err.Error())
		_ = e.maybeCompleteCampaign(ctx, campaign)
		return err
	}

	from := e.resolveFrom(campaign.FromName, campaign.FromEmail)
	replyTo := campaign.ReplyTo
	if smtp, ok := snd.(*sender.SMTPClient); ok {
		from = smtp.From()
		replyTo = smtp.ReplyTo()
	}

	headers := map[string]string{
		"X-Mailgeko-Campaign":  campaign.ID,
		"X-Mailgeko-Contact":   contact.ID,
		"X-Mailgeko-Workspace": campaign.WorkspaceID,
	}
	if u := UnsubscribeURL(RenderOptions{
		BaseURL:          e.baseURL,
		AllowUnsubscribe: campaign.AllowUnsubscribe,
		CampaignID:       campaign.ID,
		ContactID:        contact.ID,
		SigningKey:       e.trackingSecret,
	}); u != "" {
		headers["List-Unsubscribe"] = "<" + u + ">"
		headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
	}

	result, err := snd.Send(ctx, sender.Message{
		From:    from,
		To:      contact.Email,
		Subject: Substitute(campaign.Subject, contactVariables(contact)),
		HTML:    html,
		Text:    campaign.PlainText,
		ReplyTo: replyTo,
		Headers: headers,
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
		SigningKey:       e.trackingSecret,
	})

	snd, err := e.resolveSender(ctx, c.WorkspaceID)
	if err != nil {
		return err
	}

	from := e.resolveFrom(c.FromName, c.FromEmail)
	replyTo := c.ReplyTo
	if smtp, ok := snd.(*sender.SMTPClient); ok {
		from = smtp.From()
		replyTo = smtp.ReplyTo()
	}

	headers := map[string]string{}
	if u := UnsubscribeURL(RenderOptions{
		BaseURL:          e.baseURL,
		AllowUnsubscribe: c.AllowUnsubscribe,
		CampaignID:       c.ID,
		ContactID:        "test",
		SigningKey:       e.trackingSecret,
	}); u != "" {
		headers["List-Unsubscribe"] = "<" + u + ">"
		headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
	}

	_, err = snd.Send(ctx, sender.Message{
		From:    from,
		To:      to,
		Subject: Substitute(c.Subject, vars),
		HTML:    html,
		Text:    c.PlainText,
		ReplyTo: replyTo,
		Headers: headers,
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

	snd, err := e.resolveSender(ctx, ws.ID)
	if err != nil {
		return nil, err
	}

	from := e.resolveFrom(ws.FromName, ws.FromEmail)
	replyTo := ws.ReplyTo
	if smtp, ok := snd.(*sender.SMTPClient); ok {
		from = smtp.From()
		replyTo = smtp.ReplyTo()
	}

	return snd.Send(ctx, sender.Message{
		From:    from,
		To:      contact.Email,
		Subject: Substitute(subject, vars),
		HTML:    htmlBody,
		Text:    Substitute(body, vars),
		ReplyTo: replyTo,
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
func (e *Engine) SendMemberEmail(ctx context.Context, ws *store.Workspace, to, subject, htmlBody, textBody string) (*sender.SendResult, error) {
	from := e.resolveFrom(ws.FromName, ws.FromEmail)
	return e.sender.Send(ctx, sender.Message{
		From:    from,
		To:      to,
		Subject: subject,
		HTML:    renderTransactionalHTML(htmlBody, e.baseURL),
		Text:    textBody,
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
		From:    e.defaultFrom("Mailgeko"),
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
		From:    e.defaultFrom("Mailgeko"),
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
