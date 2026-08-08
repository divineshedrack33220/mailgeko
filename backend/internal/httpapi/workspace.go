package httpapi

import (
	"database/sql"
	"encoding/json"
	"log"
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

// handleListWorkspaces returns every workspace the caller belongs to, marking
// the one their session is currently bound to.
func (s *Server) handleListWorkspaces(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	workspaces, err := s.db.ListWorkspacesForUser(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list workspaces")
		return
	}
	out := make([]map[string]any, 0, len(workspaces))
	for _, ws := range workspaces {
		out = append(out, map[string]any{
			"id":      ws.ID,
			"name":    ws.Name,
			"logoUrl": ws.LogoURL,
			"role":    ws.Role,
			"active":  ws.ID == claims.GetWorkspaceID(),
		})
	}
	writeOK(w, map[string]any{"workspaces": out})
}

// handleSwitchWorkspace re-binds the caller's session to another workspace
// they belong to, issuing a fresh token scoped to it.
func (s *Server) handleSwitchWorkspace(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	var req struct {
		WorkspaceID string `json:"workspaceId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.WorkspaceID = strings.TrimSpace(req.WorkspaceID)
	if req.WorkspaceID == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "workspaceId is required")
		return
	}

	role, err := s.db.WorkspaceMemberByUserID(r.Context(), req.WorkspaceID, claims.GetUserID())
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusForbidden, "forbidden", "you are not a member of this workspace")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not verify membership")
		return
	}

	if req.WorkspaceID == claims.GetWorkspaceID() {
		writeOK(w, map[string]any{"workspaceID": req.WorkspaceID, "role": role})
		return
	}

	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load user")
		return
	}

	// Invalidate the old token so it can't be reused against the old workspace.
	if s.session != nil {
		if err := s.session.Revoke(r.Context(), user.ID, claims.GetTokenID(), s.cfg.TokenTTL); err != nil {
			log.Printf("httpapi: could not revoke session on workspace switch: %v", err)
		}
	}

	s.issueSessionToken(r.Context(), w, user, req.WorkspaceID, r, s.cfg.TokenTTL, http.StatusOK)
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
