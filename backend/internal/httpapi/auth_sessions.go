package httpapi

import (
	"context"
	"net/http"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
)

// handleListSessions returns the user's active sessions, tagging the current one.
func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	if s.session == nil {
		writeOK(w, map[string]any{"sessions": []SessionInfo{}})
		return
	}
	sessions, err := s.session.List(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list sessions")
		return
	}
	for i := range sessions {
		sessions[i].Current = sessions[i].TokenID == claims.GetTokenID()
	}
	writeOK(w, map[string]any{"sessions": sessions})
}

// handleRevokeSession signs a specific device out (never the current one).
func (s *Server) handleRevokeSession(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil || s.session == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	tokenID := r.PathValue("tokenID")
	if tokenID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "missing session id")
		return
	}
	if tokenID == claims.GetTokenID() {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "use sign out to end the current session")
		return
	}
	if err := s.session.Revoke(r.Context(), claims.GetUserID(), tokenID, s.cfg.TokenTTL); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not revoke session")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

// handleRevokeAllSessions signs out every other device.
func (s *Server) handleRevokeAllSessions(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	if s.session != nil {
		if err := s.session.RevokeAllExcept(r.Context(), claims.GetUserID(), claims.GetTokenID(), s.cfg.TokenTTL); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not revoke sessions")
			return
		}
	}
	writeOK(w, map[string]bool{"ok": true})
}

// refreshSessionActivity updates the lastSeen timestamp for the current session.
func (s *Server) refreshSessionActivity(ctx context.Context, claims *auth.Claims) {
	if s.session == nil || claims == nil {
		return
	}
	go s.session.Touch(ctx, claims.GetUserID(), claims.GetTokenID(), s.cfg.TokenTTL)
}
