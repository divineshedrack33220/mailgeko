package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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

	user, err := s.db.UserByEmail(r.Context(), req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not sign in")
		return
	}

	ok, err := auth.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !ok {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}

	workspaceID, err := s.db.WorkspaceIDForUser(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not sign in")
		return
	}

	if user.TOTPEnabled {
		pending, err := s.tokens.IssuePendingTwoFactor(user.ID, user.Email)
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

	s.issueSessionToken(r.Context(), w, user, workspaceID, r, http.StatusOK)
}
