package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/ai"
)

func (s *Server) handleGenerateSubjects(w http.ResponseWriter, r *http.Request) {
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
	if s.ai == nil {
		s.ai = ai.NewClient("", "", "")
	}

	subjects, err := s.ai.GenerateSubjectLines(r.Context(), req.Topic, strings.TrimSpace(req.Audience), strings.TrimSpace(req.Tone), req.Count)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate subject lines")
		return
	}
	writeOK(w, map[string]any{"subjects": subjects})
}
