package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func (s *Server) handleGetWorkspace(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "workspace not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load workspace")
		return
	}
	writeOK(w, map[string]any{"workspace": workspaceResponse(ws)})
}

func (s *Server) handleUpdateWorkspace(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	var req struct {
		Name      string `json:"name"`
		FromName  string `json:"fromName"`
		FromEmail string `json:"fromEmail"`
		ReplyTo   string `json:"replyTo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "workspace not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load workspace")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	ws.FromName = strings.TrimSpace(req.FromName)
	ws.FromEmail = strings.TrimSpace(req.FromEmail)
	ws.ReplyTo = strings.TrimSpace(req.ReplyTo)
	if ws.FromEmail != "" && !strings.Contains(ws.FromEmail, "@") {
		writeError(w, http.StatusUnprocessableEntity, "validation", "a valid sender email is required")
		return
	}
	if ws.ReplyTo != "" && !strings.Contains(ws.ReplyTo, "@") {
		writeError(w, http.StatusUnprocessableEntity, "validation", "a valid reply-to email is required")
		return
	}
	if err := s.db.UpdateWorkspaceName(r.Context(), claims.GetWorkspaceID(), req.Name); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update workspace")
		return
	}
	ws.Name = req.Name

	if err := s.db.UpdateWorkspaceSending(r.Context(), claims.GetWorkspaceID(), ws.FromName, ws.FromEmail, ws.ReplyTo); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update sending defaults")
		return
	}
	writeOK(w, map[string]any{"workspace": workspaceResponse(ws)})
}

func workspaceResponse(ws *store.Workspace) map[string]any {
	return map[string]any{
		"id":        ws.ID,
		"name":      ws.Name,
		"fromName":  ws.FromName,
		"fromEmail": ws.FromEmail,
		"replyTo":   ws.ReplyTo,
		"logoUrl":   ws.LogoURL,
	}
}
