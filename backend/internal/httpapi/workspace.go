package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
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
	writeOK(w, map[string]any{"workspace": workspaceResponse(ws.ID, ws.Name)})
}

func (s *Server) handleUpdateWorkspace(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	if err := s.db.UpdateWorkspaceName(r.Context(), claims.GetWorkspaceID(), req.Name); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update workspace")
		return
	}
	writeOK(w, map[string]any{"workspace": workspaceResponse(claims.GetWorkspaceID(), req.Name)})
}

func workspaceResponse(id, name string) map[string]any {
	return map[string]any{"id": id, "name": name}
}
