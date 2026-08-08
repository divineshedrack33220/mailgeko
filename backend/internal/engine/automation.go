package engine

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
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

// EnrollContact starts (or restarts) an automation flow for a single contact.
// The automation's trigger delay is applied as the initial wait.
func (e *Engine) EnrollContact(ctx context.Context, automation *store.Automation, contact *store.Contact) error {
	if automation.Status != "active" {
		return nil
	}
	if contact.Status == store.ContactUnsubscribed || contact.Status == store.ContactBounced || contact.Status == store.ContactSpam {
		return nil
	}
	runAt := time.Now().UTC()
	if automation.TriggerDelay != nil && *automation.TriggerDelay > 0 {
		runAt = runAt.Add(time.Duration(*automation.TriggerDelay) * time.Hour)
	}
	return e.store.CreateAutomationRun(ctx, &store.AutomationRun{
		ID:           uuid.NewString(),
		WorkspaceID:  automation.WorkspaceID,
		AutomationID: automation.ID,
		ContactID:    contact.ID,
		StepIndex:    0,
		RunAt:        runAt,
		Status:       store.AutomationRunActive,
	})
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
	for _, a := range automations {
		if a.TriggerType == "welcome" {
			if err := e.EnrollContact(ctx, a, contact); err != nil {
				log.Printf("automation: enroll contact %s in %s: %v", contact.ID, a.ID, err)
			}
		}
	}
	return nil
}

// EnrollAutomation runs an automation now against every contact in the
// workspace. Used by the manual "Run now" action.
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
		if err := e.EnrollContact(ctx, automation, c); err == nil {
			enrolled++
		}
	}
	return enrolled, nil
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
		if err := e.sendEmailStep(ctx, automation, contact, step.Config); err != nil {
			log.Printf("automation %s: send-email step %q failed for %s: %v", automation.ID, step.Label, contact.Email, err)
			_ = e.notify(ctx, run.WorkspaceID, "automation-failed",
				"Automation step failed",
				"The step \""+step.Label+"\" in \""+automation.Name+"\" could not send to "+contact.Email+".",
				"/automations/"+automation.ID)
		}
	case "delay":
		nextRunAt = time.Now().UTC().Add(automationDelay(step.Config))
	case "condition":
		matches, err := e.conditionStep(ctx, contact, step.Config)
		if err != nil {
			return err
		}
		if !matches {
			stop = true
		}
	case "add-tag":
		if err := e.addTagStep(ctx, contact, step.Config); err != nil {
			return err
		}
	case "remove-tag":
		if err := e.removeTagStep(ctx, contact, step.Config); err != nil {
			return err
		}
	case "unsubscribe":
		if err := e.store.UpdateContactStatus(ctx, contact.WorkspaceID, contact.ID, store.ContactUnsubscribed); err != nil {
			return err
		}
	case "webhook":
		e.webhookStep(ctx, step.Config, contact)
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

func (e *Engine) sendEmailStep(ctx context.Context, automation *store.Automation, contact *store.Contact, cfg map[string]any) error {
	if contact.Status == store.ContactUnsubscribed || contact.Status == store.ContactBounced || contact.Status == store.ContactSpam {
		return nil
	}
	campaignID, _ := cfg["campaignId"].(string)
	if campaignID == "" {
		return nil
	}
	campaign, err := e.store.GetCampaign(ctx, automation.WorkspaceID, campaignID)
	if err != nil {
		return nil
	}
	return e.SendAutomationEmail(ctx, automation.ID, campaign, contact)
}

// SendAutomationEmail sends one fully-rendered email to a contact using the
// referenced campaign's sender, subject, body and tracking settings. The
// automation id is attached so opens/clicks count toward the campaign and the
// contact's engagement.
func (e *Engine) SendAutomationEmail(ctx context.Context, automationID string, campaign *store.Campaign, contact *store.Contact) error {
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

	from := e.resolveFrom(campaign.FromName, campaign.FromEmail)
	headers := map[string]string{
		"X-Mailgeko-Automation": automationID,
		"X-Mailgeko-Contact":    contact.ID,
		"X-Mailgeko-Workspace":  campaign.WorkspaceID,
	}
	if u := UnsubscribeURL(opts); u != "" {
		headers["List-Unsubscribe"] = "<" + u + ">"
		headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
	}

	_, err := e.sender.Send(ctx, sender.Message{
		From:    from,
		To:      contact.Email,
		Subject: Substitute(campaign.Subject, contactVariables(contact)),
		HTML:    RenderHTML(body, contactVariables(contact), opts),
		Text:    campaign.PlainText,
		ReplyTo: campaign.ReplyTo,
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
	// automation "opened"/"clicked" conditions can evaluate.
	now := time.Now().UTC()
	return e.store.UpsertCampaignRecipient(ctx, &store.CampaignRecipient{
		CampaignID: campaign.ID,
		ContactID:  contact.ID,
		Status:     "sent",
		SentAt:     &now,
	})
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

func (e *Engine) webhookStep(ctx context.Context, cfg map[string]any, contact *store.Contact) {
	url, _ := cfg["url"].(string)
	if url == "" {
		return
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
	})

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(payload))
	if err != nil {
		log.Printf("automation: webhook request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.httpClient.Do(req)
	if err != nil {
		log.Printf("automation: webhook to %s failed: %v", url, err)
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
