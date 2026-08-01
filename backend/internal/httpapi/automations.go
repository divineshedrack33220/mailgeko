package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type automationRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Trigger     struct {
		Type       string            `json:"type"`
		Label      string            `json:"label"`
		Conditions []store.Condition `json:"conditions"`
		Delay      *int              `json:"delay"`
	} `json:"trigger"`
	Steps  json.RawMessage `json:"steps"`
	Status string          `json:"status"`
}

func normalizeSteps(s json.RawMessage) json.RawMessage {
	if len(s) == 0 || string(s) == "null" {
		return []byte("[]")
	}
	return s
}

func automationResponse(a *store.Automation) map[string]any {
	return map[string]any{
		"id":          a.ID,
		"name":        a.Name,
		"description": a.Description,
		"trigger": map[string]any{
			"type":       a.TriggerType,
			"label":      a.TriggerLabel,
			"conditions": orEmptySlice(a.TriggerConditions),
			"delay":      a.TriggerDelay,
		},
		"steps":     orEmptyRaw(a.Steps),
		"status":    a.Status,
		"createdAt": a.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt": a.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func (s *Server) handleListAutomations(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	automations, err := s.db.ListAutomations(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list automations")
		return
	}
	out := make([]map[string]any, 0, len(automations))
	for _, a := range automations {
		out = append(out, automationResponse(a))
	}
	writeOK(w, map[string]any{"automations": out})
}

func (s *Server) handleCreateAutomation(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req automationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	status := req.Status
	if status == "" {
		status = "draft"
	}
	a := &store.Automation{
		ID:                newID(),
		WorkspaceID:       claims.GetWorkspaceID(),
		Name:              req.Name,
		Description:       req.Description,
		TriggerType:       req.Trigger.Type,
		TriggerLabel:      req.Trigger.Label,
		TriggerConditions: req.Trigger.Conditions,
		TriggerDelay:      req.Trigger.Delay,
		Steps:             req.Steps,
		Status:            status,
	}
	a.Steps = normalizeSteps(req.Steps)
	if err := s.db.CreateAutomation(r.Context(), a); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create automation")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"automation": automationResponse(a)})
}

func (s *Server) handleGetAutomation(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	a, err := s.db.GetAutomation(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "automation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load automation")
		return
	}
	writeOK(w, map[string]any{"automation": automationResponse(a)})
}

func (s *Server) handleUpdateAutomation(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	id := r.PathValue("id")
	existing, err := s.db.GetAutomation(r.Context(), claims.GetWorkspaceID(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "automation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load automation")
		return
	}
	var req automationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	existing.Name = req.Name
	existing.Description = req.Description
	existing.TriggerType = req.Trigger.Type
	existing.TriggerLabel = req.Trigger.Label
	existing.TriggerConditions = req.Trigger.Conditions
	existing.TriggerDelay = req.Trigger.Delay
	if req.Steps != nil {
		existing.Steps = normalizeSteps(req.Steps)
	}
	if req.Status != "" {
		existing.Status = req.Status
	}
	if err := s.db.UpdateAutomation(r.Context(), existing); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update automation")
		return
	}
	writeOK(w, map[string]any{"automation": automationResponse(existing)})
}

func (s *Server) handleDeleteAutomation(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.DeleteAutomation(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete automation")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleDuplicateAutomation(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	src, err := s.db.GetAutomation(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "automation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load automation")
		return
	}

	copy := &store.Automation{
		ID:                newID(),
		WorkspaceID:       claims.GetWorkspaceID(),
		Name:              src.Name + " (copy)",
		Description:       src.Description,
		TriggerType:       src.TriggerType,
		TriggerLabel:      src.TriggerLabel,
		TriggerConditions: src.TriggerConditions,
		TriggerDelay:      src.TriggerDelay,
		Steps:             normalizeSteps(src.Steps),
		Status:            "draft",
	}
	if len(copy.Steps) == 0 {
		copy.Steps = []byte("[]")
	}
	if err := s.db.CreateAutomation(r.Context(), copy); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not duplicate automation")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"automation": automationResponse(copy)})
}
