package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
)

// rememberMeTTL is the session lifetime granted when the user opts in to
// staying signed in on a trusted device.
const rememberMeTTL = 30 * 24 * time.Hour

// Brute-force protection constants. After maxLoginFailures failures within
// the failureWindow the account is locked for lockoutDuration.
const (
	maxLoginFailures  = 5
	failureWindow     = 15 * time.Minute
	lockoutDuration   = 15 * time.Minute
	failureCounterTTL = failureWindow
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	// RememberMe requests a longer-lived session for trusted devices.
	RememberMe bool `json:"rememberMe"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "email and password are required")
		return
	}

	if s.isLoginLocked(r.Context(), req.Email) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "too many failed attempts, please try again later")
		return
	}

	user, err := s.db.UserByEmail(r.Context(), req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			// Record a failure even for unknown emails to prevent enumeration
			// from revealing whether the address is registered.
			s.recordLoginFailure(r.Context(), req.Email)
			writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not sign in")
		return
	}

	ok, err := auth.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !ok {
		s.recordLoginFailure(r.Context(), req.Email)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}

	s.clearLoginFailures(r.Context(), req.Email)

	workspaceID, err := s.db.WorkspaceIDForUser(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not sign in")
		return
	}

	if user.TOTPEnabled {
		ttl := s.cfg.TokenTTL
		if req.RememberMe {
			ttl = rememberMeTTL
		}
		pending, err := s.tokens.IssuePendingTwoFactorWithTTL(user.ID, user.Email, ttl)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not start session")
			return
		}
		writeOK(w, map[string]any{
			"requiresTwoFactor": true,
			"pendingToken":      pending,
		})
		return
	}

	ttl := s.cfg.TokenTTL
	if req.RememberMe {
		ttl = rememberMeTTL
	}
	s.issueSessionToken(r.Context(), w, user, workspaceID, r, ttl, http.StatusOK)
}

// loginFailureKey returns the Redis key used to track failed login attempts
// for the given email address.
func loginFailureKey(email string) string {
	return "login_fail:" + email
}

// isLoginLocked reports whether the email is temporarily locked due to too many
// failed login attempts.
func (s *Server) isLoginLocked(ctx context.Context, email string) bool {
	if s.session == nil {
		return false
	}
	val, err := s.session.rdb.Get(ctx, loginFailureKey(email+":lock")).Result()
	if err != nil {
		return false
	}
	return val == "1"
}

// recordLoginFailure increments the failure counter for an email. When the
// counter reaches maxLoginFailures the account is locked for lockoutDuration.
func (s *Server) recordLoginFailure(ctx context.Context, email string) {
	if s.session == nil {
		return
	}
	rdb := s.session.rdb
	key := loginFailureKey(email)
	n, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		return
	}
	_ = rdb.Expire(ctx, key, failureCounterTTL).Err()
	if n >= maxLoginFailures {
		_ = rdb.Set(ctx, loginFailureKey(email+":lock"), "1", lockoutDuration).Err()
	}
	_ = rdb.Expire(ctx, key, failureWindow).Err()
}

// clearLoginFailures resets the failure counter after a successful login.
func (s *Server) clearLoginFailures(ctx context.Context, email string) {
	if s.session == nil {
		return
	}
	rdb := s.session.rdb
	_ = rdb.Del(ctx, loginFailureKey(email), loginFailureKey(email+":lock")).Err()
}
