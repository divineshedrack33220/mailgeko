package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type segmentRequest struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	MatchType   string            `json:"matchType"`
	Conditions  []store.Condition `json:"conditions"`
}

func segmentResponse(seg *store.Segment) map[string]any {
	return map[string]any{
		"id":          seg.ID,
		"name":        seg.Name,
		"description": seg.Description,
		"matchType":   seg.MatchType,
		"conditions":  orEmptySlice(seg.Conditions),
		"createdAt":   seg.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt":   seg.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func (s *Server) handleListSegments(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	segments, err := s.db.ListSegments(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list segments")
		return
	}
	out := make([]map[string]any, 0, len(segments))
	for _, seg := range segments {
		out = append(out, segmentResponse(seg))
	}
	writeOK(w, map[string]any{"segments": out})
}

func (s *Server) handleCreateSegment(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req segmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	matchType := req.MatchType
	if matchType != "any" {
		matchType = "all"
	}
	seg := &store.Segment{
		ID:          newID(),
		WorkspaceID: claims.GetWorkspaceID(),
		Name:        req.Name,
		Description: req.Description,
		MatchType:   matchType,
		Conditions:  req.Conditions,
	}
	if err := s.db.CreateSegment(r.Context(), seg); err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			writeError(w, http.StatusConflict, "duplicate", "a segment with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not create segment")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"segment": segmentResponse(seg)})
}

func (s *Server) handleGetSegment(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	seg, err := s.db.GetSegment(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "segment not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load segment")
		return
	}
	writeOK(w, map[string]any{"segment": segmentResponse(seg)})
}

func (s *Server) handleUpdateSegment(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	id := r.PathValue("id")
	var req segmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	matchType := req.MatchType
	if matchType != "any" {
		matchType = "all"
	}
	seg := &store.Segment{
		ID:          id,
		WorkspaceID: claims.GetWorkspaceID(),
		Name:        req.Name,
		Description: req.Description,
		MatchType:   matchType,
		Conditions:  req.Conditions,
	}
	if err := s.db.UpdateSegment(r.Context(), seg); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update segment")
		return
	}
	writeOK(w, map[string]any{"segment": segmentResponse(seg)})
}

func (s *Server) handleDeleteSegment(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.DeleteSegment(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete segment")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}
