package engine

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/divineshedrack33220/mailgeko/backend/internal/sender"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type automationStep struct {
	ID     string         `json:"id"`
	Type   string         `json:"type"`
	Label  string         `json:"label"`
	Config map[string]any `json:"config"`
}

// automationMaxStepAttempts bounds how many times a single failing step is
// retried (across worker retries and scheduler re-claims) before the run is
// marked failed instead of retrying forever.
const automationMaxStepAttempts = 10

// EnrollContact starts (or restarts) an automation flow for a single contact.
// The automation's trigger delay is applied as the initial wait. Inactive
// automations and opted-out contacts are skipped.
func (e *Engine) EnrollContact(ctx context.Context, automation *store.Automation, contact *store.Contact) error {
	_, err := e.enrollContact(ctx, automation, contact, false)
	return err
}

// enrollContact starts an automation for one contact and reports whether a run
// was actually created (false for skips: inactive automation or an opted-out
// contact). The boolean lets bulk paths count real enrollments without treating
// a skip as either an error or an enrollment.
func (e *Engine) enrollContact(ctx context.Context, automation *store.Automation, contact *store.Contact, force bool) (bool, error) {
	if !force && automation.Status != "active" {
		return false, nil
	}
	if contact.Status == store.ContactUnsubscribed || contact.Status == store.ContactBounced || contact.Status == store.ContactSpam {
		return false, nil
	}
	runAt := time.Now().UTC()
	if automation.TriggerDelay != nil && *automation.TriggerDelay > 0 {
		runAt = runAt.Add(time.Duration(*automation.TriggerDelay) * time.Hour)
	}
	err := e.store.CreateAutomationRun(ctx, &store.AutomationRun{
		ID:           uuid.NewString(),
		WorkspaceID:  automation.WorkspaceID,
		AutomationID: automation.ID,
		ContactID:    contact.ID,
		StepIndex:    0,
		RunAt:        runAt,
		Status:       store.AutomationRunActive,
	})
	return err == nil, err
}

// filterWelcomeAutomations returns the welcome-triggered automations from a
// list, keeping enrollment cheap for bulk imports.
func filterWelcomeAutomations(automations []*store.Automation) []*store.Automation {
	var out []*store.Automation
	for _, a := range automations {
		if a.TriggerType == "welcome" {
			out = append(out, a)
		}
	}
	return out
}

// EnrollWelcome enrolls a new contact in every active welcome-triggered
// automation in their workspace. Called after a contact is created or
// imported. Enrollment is best-effort: a failure here must never fail the
// contact creation or import that triggered it.
func (e *Engine) EnrollWelcome(ctx context.Context, contact *store.Contact) error {
	automations, err := e.store.ListAutomations(ctx, contact.WorkspaceID)
	if err != nil {
		log.Printf("automation: list automations for welcome enrollment: %v", err)
		return nil
	}
	e.enrollWelcome(ctx, contact, filterWelcomeAutomations(automations))
	return nil
}

// enrollWelcome enrolls a contact into a pre-fetched list of welcome
// automations, best-effort.
func (e *Engine) enrollWelcome(ctx context.Context, contact *store.Contact, automations []*store.Automation) {
	for _, a := range automations {
		if err := e.EnrollContact(ctx, a, contact); err != nil {
			log.Printf("automation: enroll contact %s in %s: %v", contact.ID, a.ID, err)
		}
	}
}

// EnrollAutomation runs an automation now against every contact in the
// workspace. Used by the manual "Run now" action. It runs the automation
// regardless of its status (the user explicitly asked), but still skips
// opted-out contacts.
func (e *Engine) EnrollAutomation(ctx context.Context, workspaceID, automationID string) (int, error) {
	automation, err := e.store.GetAutomation(ctx, workspaceID, automationID)
	if err != nil {
		return 0, err
	}
	contacts, err := e.store.AllContacts(ctx, workspaceID)
	if err != nil {
		return 0, err
	}
	enrolled := 0
	for _, c := range contacts {
		if ok, err := e.enrollContact(ctx, automation, c, true); err == nil && ok {
			enrolled++
		}
	}
	return enrolled, nil
}

// RestartFailedRuns re-enrolls only the contacts whose run for this automation
// is marked failed. Re-enrollment resets the run to the start of the flow
// (with the trigger delay applied), so a recoverable failure is not a
// dead-end. Opted-out contacts are still skipped.
func (e *Engine) RestartFailedRuns(ctx context.Context, workspaceID, automationID string) (int, error) {
	automation, err := e.store.GetAutomation(ctx, workspaceID, automationID)
	if err != nil {
		return 0, err
	}
	contacts, err := e.store.ListFailedRunContacts(ctx, workspaceID, automationID)
	if err != nil {
		return 0, err
	}
	restarted := 0
	for _, c := range contacts {
		if ok, err := e.enrollContact(ctx, automation, c, true); err == nil && ok {
			restarted++
		}
	}
	return restarted, nil
}

// RunAutomationStep executes the next pending step of an automation run. The
// worker dispatches runs here one step at a time; a delay step advances the
// run's run_at instead of blocking.
func (e *Engine) RunAutomationStep(ctx context.Context, runID string) error {
	run, err := e.store.GetAutomationRun(ctx, runID)
	if err != nil {
		return err
	}
	if run.Status == store.AutomationRunCompleted || run.Status == store.AutomationRunFailed {
		return nil
	}

	automation, err := e.store.GetAutomation(ctx, run.WorkspaceID, run.AutomationID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			_ = e.store.AdvanceAutomationRun(ctx, run.ID, store.AutomationRunCompleted, run.StepIndex, run.RunAt)
			return nil
		}
		return err
	}
	contact, err := e.store.GetContact(ctx, run.WorkspaceID, run.ContactID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			_ = e.store.AdvanceAutomationRun(ctx, run.ID, store.AutomationRunCompleted, run.StepIndex, run.RunAt)
			return nil
		}
		return err
	}

	steps, err := parseAutomationSteps(automation.Steps)
	if err != nil {
		return err
	}
	if run.StepIndex < 0 {
		run.StepIndex = 0
	}

	if run.StepIndex >= len(steps) {
		return e.store.AdvanceAutomationRun(ctx, run.ID, store.AutomationRunCompleted, run.StepIndex, run.RunAt)
	}

	step := steps[run.StepIndex]
	nextRunAt := time.Now().UTC()
	stop := false

	switch step.Type {
	case "send-email":
		if err := e.sendEmailStep(ctx, run.ID, automation, contact, step.Config); err != nil {
			return e.boundStepFailure(ctx, run, automation, step, contact, err)
		}
	case "delay":
		if len(step.Config) == 0 {
			log.Printf("automation %s: run %s delay step has no duration; using default 1 day",
				automation.ID, run.ID)
		}
		nextRunAt = time.Now().UTC().Add(automationDelay(step.Config))
	case "condition":
		matches, err := e.conditionStep(ctx, contact, step.Config)
		if err != nil {
			return e.boundStepFailure(ctx, run, automation, step, contact, err)
		}
		if !matches {
			stop = true
		}
	case "add-tag":
		if err := e.addTagStep(ctx, contact, step.Config); err != nil {
			return e.boundStepFailure(ctx, run, automation, step, contact, err)
		}
	case "remove-tag":
		if err := e.removeTagStep(ctx, contact, step.Config); err != nil {
			return e.boundStepFailure(ctx, run, automation, step, contact, err)
		}
	case "unsubscribe":
		if listID, ok := step.Config["listId"].(string); ok && listID != "" && listID != "all" {
			if err := e.store.RemoveContactFromList(ctx, listID, contact.ID); err != nil {
				return e.boundStepFailure(ctx, run, automation, step, contact, err)
			}
		} else {
			if err := e.store.UpdateContactStatus(ctx, contact.WorkspaceID, contact.ID, store.ContactUnsubscribed); err != nil {
				return e.boundStepFailure(ctx, run, automation, step, contact, err)
			}
		}
	case "webhook":
		e.webhookStep(ctx, run.ID, step.Config, contact)
	default:
		log.Printf("automation %s: unknown step type %q, skipping", automation.ID, step.Type)
	}

	if stop {
		return e.store.AdvanceAutomationRun(ctx, run.ID, store.AutomationRunCompleted, run.StepIndex, run.RunAt)
	}

	nextIndex := run.StepIndex + 1
	status := store.AutomationRunActive
	if nextIndex >= len(steps) {
		status = store.AutomationRunCompleted
	}
	return e.store.AdvanceAutomationRun(ctx, run.ID, status, nextIndex, nextRunAt)
}

// boundStepFailure handles a step that failed to execute. It returns the error
// so the worker retries it, but once the run has exhausted its retry budget
// the run is marked failed and the owner is notified, so a permanently failing
// step never retries forever.
func (e *Engine) boundStepFailure(ctx context.Context, run *store.AutomationRun, automation *store.Automation, step automationStep, contact *store.Contact, err error) error {
	attempts, bumpErr := e.store.BumpAutomationRunAttempts(ctx, run.ID)
	if bumpErr != nil {
		return err
	}
	if attempts < automationMaxStepAttempts {
		log.Printf("automation %s: step %q failed for %s (attempt %d/%d): %v",
			automation.ID, step.Label, contact.Email, attempts, automationMaxStepAttempts, err)
		return err
	}
	_ = e.store.FailAutomationRun(ctx, run.ID, err.Error(), run.StepIndex)
	_ = e.notify(ctx, run.WorkspaceID, "automation-failed",
		"Automation run stopped",
		"The step \""+step.Label+"\" in \""+automation.Name+"\" kept failing for "+contact.Email+". The run was stopped and will not retry.",
		"/automations/"+automation.ID)
	return nil
}

func (e *Engine) sendEmailStep(ctx context.Context, runID string, automation *store.Automation, contact *store.Contact, cfg map[string]any) error {
	if contact.Status == store.ContactUnsubscribed || contact.Status == store.ContactBounced || contact.Status == store.ContactSpam {
		return nil
	}
	campaignID, _ := cfg["campaignId"].(string)
	if campaignID == "" {
		// Not an error: an unconfigured send-email step is skipped so the flow
		// continues. It is logged so misconfigured automations are audible.
		log.Printf("automation %s: run %s step has no campaignId for %s; skipping", automation.ID, runID, contact.Email)
		return nil
	}
	campaign, err := e.store.GetCampaign(ctx, automation.WorkspaceID, campaignID)
	if err != nil {
		// Skipping (rather than failing) keeps a stale campaign reference from
		// stalling every run, but the reason is surfaced in the logs.
		log.Printf("automation %s: run %s campaign %s not found for %s; skipping", automation.ID, runID, campaignID, contact.Email)
		return nil
	}
	// Idempotency guard: if a retried step already sent this email for this
	// run, don't send it again.
	sent, err := e.store.RecipientSentByAutomation(ctx, campaign.ID, contact.ID, runID)
	if err != nil {
		return err
	}
	if sent {
		return nil
	}
	return e.SendAutomationEmail(ctx, runID, automation.ID, campaign, contact)
}

// SendAutomationEmail sends one fully-rendered email to a contact using the
// referenced campaign's sender, subject, body and tracking settings. The
// automation id is attached so opens/clicks count toward the campaign and the
// contact's engagement.
func (e *Engine) SendAutomationEmail(ctx context.Context, automationRunID, automationID string, campaign *store.Campaign, contact *store.Contact) error {
	body := campaign.HTMLContent
	if body == "" && campaign.TemplateID != "" {
		if tpl, err := e.store.GetTemplate(ctx, campaign.WorkspaceID, campaign.TemplateID); err == nil {
			body = tpl.HTML
		}
	}
	if body == "" {
		body = "<p>" + campaign.PlainText + "</p>"
	}
	if body == "" {
		log.Printf("automation %s: campaign %s has no body (html or plain text); skipping send to %s",
			automationID, campaign.ID, contact.Email)
		return nil
	}

	opts := RenderOptions{
		BaseURL:          e.baseURL,
		TrackOpens:       campaign.TrackOpens,
		TrackClicks:      campaign.TrackClicks,
		AllowUnsubscribe: campaign.AllowUnsubscribe,
		CampaignID:       campaign.ID,
		ContactID:        contact.ID,
		SigningKey:       e.trackingSecret,
	}

	snd, err := e.resolveSender(ctx, campaign.WorkspaceID)
	if err != nil {
		return err
	}

	from := e.resolveFrom(campaign.FromName, campaign.FromEmail)
	replyTo := campaign.ReplyTo
	if smtp, ok := snd.(*sender.SMTPClient); ok {
		from = smtp.From()
		replyTo = smtp.ReplyTo()
	}

	headers := map[string]string{
		"X-Mailgeko-Automation": automationID,
		"X-Mailgeko-Contact":    contact.ID,
		"X-Mailgeko-Workspace":  campaign.WorkspaceID,
	}
	if u := UnsubscribeURL(opts); u != "" {
		headers["List-Unsubscribe"] = "<" + u + ">"
		headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
	}

	_, err = snd.Send(ctx, sender.Message{
		From:    from,
		To:      contact.Email,
		Subject: Substitute(campaign.Subject, contactVariables(contact)),
		HTML:    RenderHTML(body, contactVariables(contact), opts),
		Text:    campaign.PlainText,
		ReplyTo: replyTo,
		Headers: headers,
		Tags: []sender.Tag{
			{Name: "campaign", Value: campaign.ID},
			{Name: "automation", Value: automationID},
		},
	})
	if err != nil {
		return err
	}
	// Record the recipient so engagement (opens/clicks) can be tracked and
	// automation "opened"/"clicked" conditions can evaluate. This row is also
	// the idempotency marker for retried steps.
	now := time.Now().UTC()
	if err := e.store.MarkAutomationSent(ctx, &store.CampaignRecipient{
		CampaignID:      campaign.ID,
		ContactID:       contact.ID,
		Status:          "sent",
		AutomationRunID: automationRunID,
		SentAt:          &now,
	}); err != nil {
		return err
	}
	if campaign.TemplateID != "" {
		_ = e.store.IncrementTemplateUsed(ctx, campaign.WorkspaceID, campaign.TemplateID)
	}
	return nil
}

func (e *Engine) conditionStep(ctx context.Context, contact *store.Contact, cfg map[string]any) (bool, error) {
	kind, _ := cfg["condition"].(string)
	switch kind {
	case "opened", "clicked":
		campaignID, _ := cfg["campaignId"].(string)
		if campaignID == "" {
			return false, nil
		}
		return e.store.RecipientEngaged(ctx, campaignID, contact.ID, kind)
	case "tag":
		tag, _ := cfg["tag"].(string)
		if tag == "" {
			return false, nil
		}
		for _, t := range contact.Tags {
			if t == tag {
				return true, nil
			}
		}
		return false, nil
	case "segment":
		segmentID, _ := cfg["segmentId"].(string)
		if segmentID == "" {
			return false, nil
		}
		seg, err := e.store.GetSegment(ctx, contact.WorkspaceID, segmentID)
		if err != nil {
			return false, nil
		}
		return segmentMatches(seg, contact), nil
	}
	return false, nil
}

func (e *Engine) addTagStep(ctx context.Context, contact *store.Contact, cfg map[string]any) error {
	tag, _ := cfg["tag"].(string)
	if tag == "" {
		return nil
	}
	for _, t := range contact.Tags {
		if t == tag {
			return nil
		}
	}
	contact.Tags = append(contact.Tags, tag)
	return e.store.UpdateContact(ctx, contact)
}

func (e *Engine) removeTagStep(ctx context.Context, contact *store.Contact, cfg map[string]any) error {
	tag, _ := cfg["tag"].(string)
	if tag == "" {
		return nil
	}
	out := contact.Tags[:0]
	for _, t := range contact.Tags {
		if t != tag {
			out = append(out, t)
		}
	}
	contact.Tags = out
	return e.store.UpdateContact(ctx, contact)
}

func (e *Engine) webhookStep(ctx context.Context, runID string, cfg map[string]any, contact *store.Contact) {
	rawURL, _ := cfg["url"].(string)
	if rawURL == "" {
		return
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		log.Printf("automation: webhook invalid URL: %s", rawURL)
		return
	}
	if !e.allowPrivateHooks {
		host := parsed.Hostname()
		if ip := net.ParseIP(host); ip != nil {
			if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsPrivate() {
				log.Printf("automation: webhook blocked private IP: %s", host)
				return
			}
		} else if strings.HasSuffix(host, ".local") || host == "localhost" {
			log.Printf("automation: webhook blocked local host: %s", host)
			return
		}
	}
	method := "POST"
	if m, ok := cfg["method"].(string); ok && m != "" {
		method = strings.ToUpper(m)
	}
	payload, _ := json.Marshal(map[string]any{
		"email":     contact.Email,
		"firstName": contact.FirstName,
		"lastName":  contact.LastName,
		"company":   contact.Company,
		"position":  contact.Position,
		"tags":      contact.Tags,
		"runId":     runID,
	})

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, method, rawURL, bytes.NewReader(payload))
	if err != nil {
		log.Printf("automation: webhook request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Idempotency-Key", runID)
	resp, err := e.httpClient.Do(req)
	if err != nil {
		log.Printf("automation: webhook to %s failed: %v", rawURL, err)
		return
	}
	_ = resp.Body.Close()
}

func parseAutomationSteps(raw []byte) ([]automationStep, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return []automationStep{}, nil
	}
	var steps []automationStep
	if err := json.Unmarshal(raw, &steps); err != nil {
		return nil, err
	}
	if steps == nil {
		steps = []automationStep{}
	}
	return steps, nil
}

// automationDelay resolves a delay step's configured duration into a
// time.Duration. Units default to days.
func automationDelay(cfg map[string]any) time.Duration {
	duration := 1.0
	if v, ok := cfg["duration"].(float64); ok && v > 0 {
		duration = v
	}
	unit := "days"
	if u, ok := cfg["unit"].(string); ok && u != "" {
		unit = u
	}
	var d time.Duration
	switch strings.ToLower(unit) {
	case "minutes", "minute", "min", "mins":
		d = time.Minute
	case "hours", "hour", "hr", "hrs":
		d = time.Hour
	case "weeks", "week":
		d = 7 * 24 * time.Hour
	default:
		d = 24 * time.Hour
	}
	return time.Duration(duration * float64(d))
}
