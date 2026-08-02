package httpapi

import (
	"net/http"
	"time"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
		"env":    s.cfg.Env,
	})
}

// handlePing answers with an empty 200 and no dependencies, so platform health
// checks (Render, etc.) can probe the API without touching Redis or the DB.
func (s *Server) handlePing(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}
