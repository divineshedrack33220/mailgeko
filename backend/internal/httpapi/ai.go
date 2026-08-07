package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/divineshedrack33220/mailgeko/backend/internal/ai"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func (s *Server) aiClient() *ai.Client {
	if s.ai == nil {
		s.ai = ai.NewClient("", "", "")
	}
	return s.ai
}

func (s *Server) recordAIHistory(ctx context.Context, workspaceID, kind, prompt, result string) {
	if workspaceID == "" || strings.TrimSpace(result) == "" {
		return
	}
	_ = s.db.CreateAIHistory(ctx, &store.AIHistory{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		Kind:        kind,
		Prompt:      prompt,
		Result:      result,
	})
}

func (s *Server) handleGenerateSubjects(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		Topic    string `json:"topic"`
		Audience string `json:"audience"`
		Tone     string `json:"tone"`
		Count    int    `json:"count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Topic = strings.TrimSpace(req.Topic)
	if req.Topic == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "topic is required")
		return
	}

	subjects, err := s.aiClient().GenerateSubjectLines(r.Context(), req.Topic, strings.TrimSpace(req.Audience), strings.TrimSpace(req.Tone), req.Count)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate subject lines")
		return
	}
	s.recordAIHistory(r.Context(), claims.GetWorkspaceID(), "subject", req.Topic, strings.Join(subjects, "\n"))
	writeOK(w, map[string]any{"subjects": subjects})
}

func (s *Server) handleGenerateCampaign(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		Prompt     string `json:"prompt"`
		Draft      string `json:"draft"`
		BrandVoice string `json:"brandVoice"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" && strings.TrimSpace(req.Draft) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "prompt or draft is required")
		return
	}
	if strings.TrimSpace(req.BrandVoice) == "" {
		ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
		if err == nil {
			req.BrandVoice = ws.BrandVoice
		}
	}

	out, err := s.aiClient().GenerateCampaign(r.Context(), req.Prompt, req.Draft, strings.TrimSpace(req.BrandVoice))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate campaign")
		return
	}

	label := req.Prompt
	if label == "" {
		label = req.Draft
	}
	s.recordAIHistory(r.Context(), claims.GetWorkspaceID(), "campaign", label, out.Subject+"\n\n"+out.Body)
	writeOK(w, map[string]any{"subject": out.Subject, "body": out.Body})
}

func (s *Server) handleListAIHistory(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	items, err := s.db.ListAIHistory(r.Context(), claims.GetWorkspaceID(), 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load history")
		return
	}
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		out = append(out, map[string]any{
			"id":        it.ID,
			"kind":      it.Kind,
			"prompt":    it.Prompt,
			"result":    it.Result,
			"createdAt": it.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	writeOK(w, map[string]any{"history": out})
}

func (s *Server) handleDeleteAIHistory(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.DeleteAIHistory(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete history")
		return
	}
	writeOK(w, map[string]any{"ok": true})
}

func (s *Server) handleGetBrandVoice(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load workspace")
		return
	}
	writeOK(w, map[string]any{"brandVoice": ws.BrandVoice})
}

func (s *Server) handleUpdateBrandVoice(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	var req struct {
		BrandVoice string `json:"brandVoice"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	brandVoice := strings.TrimSpace(req.BrandVoice)
	if err := s.db.UpdateWorkspaceBrandVoice(r.Context(), claims.GetWorkspaceID(), brandVoice); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not save brand voice")
		return
	}
	writeOK(w, map[string]any{"brandVoice": brandVoice})
}
