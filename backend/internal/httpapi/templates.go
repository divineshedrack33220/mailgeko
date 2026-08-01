package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

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
		FromName:         "Mailgeko",
		FromEmail:        "team@mailgeko.dev",
		TrackOpens:       true,
		TrackClicks:      true,
		AllowUnsubscribe: true,
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
