package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/ai"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

var templateVarRegex = regexp.MustCompile(`\{\{\s*([^}\s]+)\s*\}\}`)

var templateCategories = map[string]bool{
	"Newsletter": true, "Promotional": true, "Transactional": true, "Welcome": true,
	"Abandoned Cart": true, "Re-engagement": true, "Announcement": true,
}

type templateRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Thumbnail   string   `json:"thumbnail"`
	MJML        string   `json:"mjml"`
	HTML        string   `json:"html"`
	Variables   []string `json:"variables"`
	Tags        []string `json:"tags"`
	IsFavorite  bool     `json:"isFavorite"`
}

func templateResponse(t *store.Template) map[string]any {
	return map[string]any{
		"id":          t.ID,
		"name":        t.Name,
		"description": t.Description,
		"category":    t.Category,
		"thumbnail":   t.Thumbnail,
		"mjml":        t.MJML,
		"html":        t.HTML,
		"variables":   orEmptySlice(t.Variables),
		"tags":        orEmptySlice(t.Tags),
		"isFavorite":  t.IsFavorite,
		"usedCount":   t.UsedCount,
		"createdAt":   t.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt":   t.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func (s *Server) handleListTemplates(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	templates, err := s.db.ListTemplates(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list templates")
		return
	}
	out := make([]map[string]any, 0, len(templates))
	for _, t := range templates {
		out = append(out, templateResponse(t))
	}
	writeOK(w, map[string]any{"templates": out})
}

func (s *Server) handleCreateTemplate(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req templateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	t := &store.Template{
		ID:          newID(),
		WorkspaceID: claims.GetWorkspaceID(),
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Thumbnail:   req.Thumbnail,
		MJML:        req.MJML,
		HTML:        req.HTML,
		Variables:   req.Variables,
		Tags:        req.Tags,
		IsFavorite:  req.IsFavorite,
	}
	if err := s.db.CreateTemplate(r.Context(), t); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create template")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"template": templateResponse(t)})
}

func (s *Server) handleGetTemplate(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	t, err := s.db.GetTemplate(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "template not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load template")
		return
	}
	writeOK(w, map[string]any{"template": templateResponse(t)})
}

func (s *Server) handleGenerateTemplate(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		Prompt     string `json:"prompt"`
		BrandVoice string `json:"brandVoice"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "prompt is required")
		return
	}
	if strings.TrimSpace(req.BrandVoice) == "" {
		ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
		if err == nil {
			req.BrandVoice = ws.BrandVoice
		}
	}

	d, err := s.aiClient().GenerateTemplate(r.Context(), req.Prompt, strings.TrimSpace(req.BrandVoice))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate template")
		return
	}
	category := d.Category
	if !templateCategories[category] {
		category = "Newsletter"
	}
	mjml := buildTemplateMJML(d)

	s.recordAIHistory(r.Context(), claims.GetWorkspaceID(), "template", req.Prompt, d.Subject+"\n"+d.Heading+"\n"+d.Body)
	writeOK(w, map[string]any{
		"mjml":      mjml,
		"html":      mjml,
		"name":      d.Name,
		"category":  category,
		"subject":   d.Subject,
		"variables": templateVariables(d),
	})
}

func mjmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

// buildTemplateMJML wraps a generated template draft in a clean, single-column
// MJML layout that renders in the code editor and as a campaign body.
func buildTemplateMJML(d *ai.TemplateDraft) string {
	heading := mjmlEscape(strings.TrimSpace(d.Heading))
	body := mjmlEscape(strings.TrimSpace(d.Body))
	body = strings.ReplaceAll(body, "\n\n", "</mj-text>\n<mj-text font-size=\"16px\" line-height=\"1.6\" color=\"#52525b\">")
	body = strings.ReplaceAll(body, "\n", "<br/>")
	cta := mjmlEscape(strings.TrimSpace(d.CTA))
	if cta == "" {
		cta = "Learn more"
	}

	var b strings.Builder
	b.WriteString("<mjml>\n")
	b.WriteString("  <mj-body background-color=\"#f4f4f5\">\n")
	b.WriteString("    <mj-section background-color=\"#ffffff\" padding=\"40px 32px\" border-radius=\"12px\">\n")
	b.WriteString("      <mj-column>\n")
	b.WriteString("        <mj-text font-size=\"24px\" font-weight=\"700\" color=\"#18181b\">" + heading + "</mj-text>\n")
	b.WriteString("        <mj-text font-size=\"16px\" line-height=\"1.6\" color=\"#52525b\">" + body + "</mj-text>\n")
	b.WriteString("        <mj-button href=\"{{cta_url}}\" background-color=\"#3bb974\" color=\"#ffffff\" border-radius=\"8px\" padding=\"12px 24px\">" + cta + "</mj-button>\n")
	b.WriteString("        <mj-text font-size=\"12px\" color=\"#a1a1aa\" align=\"center\"><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></mj-text>\n")
	b.WriteString("      </mj-column>\n")
	b.WriteString("    </mj-section>\n")
	b.WriteString("  </mj-body>\n")
	b.WriteString("</mjml>")
	return b.String()
}

// templateVariables returns the merge variables used by a generated template,
// always including the standard link/first-name ones.
func templateVariables(d *ai.TemplateDraft) []string {
	seen := map[string]bool{"first_name": true, "cta_url": true, "unsubscribe_url": true}
	text := d.Subject + "\n" + d.Heading + "\n" + d.Body
	for _, m := range templateVarRegex.FindAllStringSubmatch(text, -1) {
		if v := strings.TrimSpace(m[1]); v != "" {
			seen[v] = true
		}
	}
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func (s *Server) handleUpdateTemplate(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	id := r.PathValue("id")
	var req templateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	t := &store.Template{
		ID:          id,
		WorkspaceID: claims.GetWorkspaceID(),
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Thumbnail:   req.Thumbnail,
		MJML:        req.MJML,
		HTML:        req.HTML,
		Variables:   req.Variables,
		Tags:        req.Tags,
		IsFavorite:  req.IsFavorite,
	}
	if err := s.db.UpdateTemplate(r.Context(), t); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update template")
		return
	}
	writeOK(w, map[string]any{"template": templateResponse(t)})
}

func (s *Server) handleDeleteTemplate(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.DeleteTemplate(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete template")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleSendTestTemplate(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	tpl, err := s.db.GetTemplate(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "template not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load template")
		return
	}
	var req struct {
		Emails  []string `json:"emails"`
		Subject string   `json:"subject"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if len(req.Emails) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "at least one email is required")
		return
	}
	if s.engine == nil {
		writeError(w, http.StatusInternalServerError, "internal", "sending is not configured")
		return
	}
	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = tpl.Name
	}
	c := &store.Campaign{
		ID:               newID(),
		WorkspaceID:      claims.GetWorkspaceID(),
		Subject:          subject,
		HTMLContent:      tpl.HTML,
		TrackOpens:       true,
		TrackClicks:      true,
		AllowUnsubscribe: true,
	}
	if ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID()); err == nil {
		c.FromName = ws.FromName
		c.FromEmail = ws.FromEmail
		c.ReplyTo = ws.ReplyTo
	}
	for _, email := range req.Emails {
		email = strings.TrimSpace(email)
		if email == "" {
			continue
		}
		if err := s.engine.SendTestEmail(r.Context(), c, email); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not send test: "+err.Error())
			return
		}
	}
	writeOK(w, map[string]any{"sent": true})
}
