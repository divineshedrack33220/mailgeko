package httpapi

import (
	"context"
	"net/http"
	"sync"
	"time"

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

// touchGate throttles goroutine spawns for session activity tracking. Redis
// writes are additionally throttled inside SessionStore.Touch (SETNX), but the
// gate avoids spawning a goroutine on every request.
type touchGate struct {
	mu      sync.Mutex
	entries map[string]time.Time
}

var sessionTouch = &touchGate{entries: make(map[string]time.Time)}

func (g *touchGate) shouldTouch(key string) bool {
	now := time.Now()
	g.mu.Lock()
	defer g.mu.Unlock()
	if last, ok := g.entries[key]; ok && now.Sub(last) < 5*time.Minute {
		return false
	}
	if len(g.entries) > 16384 {
		for k, t := range g.entries {
			if now.Sub(t) >= 5*time.Minute {
				delete(g.entries, k)
			}
		}
	}
	g.entries[key] = now
	return true
}

// refreshSessionActivity records lastSeen on a session, at most once per
// session per five minutes, without blocking the request or leaking goroutines.
func (s *Server) refreshSessionActivity(ctx context.Context, claims *auth.Claims) {
	if s.session == nil || claims == nil {
		return
	}
	key := claims.GetUserID() + ":" + claims.GetTokenID()
	if !sessionTouch.shouldTouch(key) {
		return
	}
	// Run outside the request lifecycle so cancellation cannot abort the write.
	touchCtx := context.WithoutCancel(ctx)
	go s.session.Touch(touchCtx, claims.GetUserID(), claims.GetTokenID(), s.cfg.TokenTTL)
}
