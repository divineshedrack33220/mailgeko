package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
)

// ContactSearcher is implemented by *engine.Engine and fakes in tests.
type ContactSearcher interface {
	SearchContacts(ctx context.Context, workspaceID, query string, limit int) ([]engine.SearchResult, error)
	SimilarContacts(ctx context.Context, workspaceID, contactID string, limit int) ([]engine.SearchResult, error)
	EmbeddingEnabled() bool
}

func (s *Server) requireSearch(w http.ResponseWriter, r *http.Request) bool {
	if s.searcher == nil || !s.searcher.EmbeddingEnabled() {
		writeError(w, http.StatusServiceUnavailable, "search_unavailable",
			"vector search is not configured (set POSTGRES_DSN and OPENAI_API_KEY)")
		return false
	}
	return true
}

// maybeEnqueueEmbed enqueues an embedding refresh after a contact is created or
// updated. It is a no-op when vector search is not configured.
func (s *Server) maybeEnqueueEmbed(r *http.Request, workspaceID, contactID string) {
	if s.searcher == nil || !s.searcher.EmbeddingEnabled() {
		return
	}
	_ = s.queue.EnqueueEmbedContact(r.Context(), queueEmbedContactPayload{
		WorkspaceID: workspaceID,
		ContactID:   contactID,
	})
}

func parseLimit(r *http.Request, def int) int {
	if k := r.URL.Query().Get("k"); k != "" {
		if n, err := strconv.Atoi(k); err == nil && n > 0 && n <= 50 {
			return n
		}
	}
	return def
}

func (s *Server) handleSearchContacts(w http.ResponseWriter, r *http.Request) {
	if !s.requireSearch(w, r) {
		return
	}
	query := r.URL.Query().Get("q")
	if query == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "q is required")
		return
	}
	workspaceID := claimsFrom(r).GetWorkspaceID()
	results, err := s.searcher.SearchContacts(r.Context(), workspaceID, query, parseLimit(r, 10))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not run search")
		return
	}
	writeOK(w, map[string]any{
		"query": query,
		"hits":  searchResults(results),
	})
}

func (s *Server) handleSimilarContacts(w http.ResponseWriter, r *http.Request) {
	if !s.requireSearch(w, r) {
		return
	}
	workspaceID := claimsFrom(r).GetWorkspaceID()
	contactID := r.PathValue("id")
	if _, err := s.db.GetContact(r.Context(), workspaceID, contactID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "contact not found")
		return
	}
	results, err := s.searcher.SimilarContacts(r.Context(), workspaceID, contactID, parseLimit(r, 10))
	if errors.Is(err, engine.ErrEmbeddingNotConfigured) {
		writeError(w, http.StatusServiceUnavailable, "search_unavailable", "vector search is not configured")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load similar contacts")
		return
	}
	writeOK(w, map[string]any{
		"contactId": contactID,
		"hits":      searchResults(results),
	})
}

func searchResults(results []engine.SearchResult) []map[string]any {
	out := make([]map[string]any, 0, len(results))
	for _, res := range results {
		out = append(out, map[string]any{
			"contact": contactResponse(res.Contact),
			"score":   res.Score,
		})
	}
	return out
}

func (s *Server) handleEmbedContact(w http.ResponseWriter, r *http.Request) {
	if !s.requireSearch(w, r) {
		return
	}
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	workspaceID := claimsFrom(r).GetWorkspaceID()
	contactID := r.PathValue("id")
	if _, err := s.db.GetContact(r.Context(), workspaceID, contactID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "contact not found")
		return
	}
	if err := s.queue.EnqueueEmbedContact(r.Context(), queueEmbedContactPayload{
		WorkspaceID: workspaceID,
		ContactID:   contactID,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not enqueue embedding job")
		return
	}
	writeOK(w, map[string]any{"contactId": contactID, "queued": true})
}

func (s *Server) handleEmbedAllContacts(w http.ResponseWriter, r *http.Request) {
	if !s.requireSearch(w, r) {
		return
	}
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	workspaceID := claimsFrom(r).GetWorkspaceID()
	if err := s.queue.EnqueueEmbedWorkspace(r.Context(), queueEmbedWorkspacePayload{WorkspaceID: workspaceID}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not enqueue embedding job")
		return
	}
	writeOK(w, map[string]any{"queued": true})
}
