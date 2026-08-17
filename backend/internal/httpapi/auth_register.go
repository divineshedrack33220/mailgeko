package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Email == "" || !strings.Contains(req.Email, "@") {
		writeError(w, http.StatusUnprocessableEntity, "validation", "a valid email is required")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}

	// Password is optional: when omitted the user will set it via the
	// verification link (email verification + password setup in one step).
	hasPassword := strings.TrimSpace(req.Password) != ""
	if hasPassword && len(req.Password) < 8 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "password must be at least 8 characters")
		return
	}

	if _, err := s.db.UserByEmail(r.Context(), req.Email); err == nil {
		writeError(w, http.StatusConflict, "email_taken", "an account with this email already exists")
		return
	}

	user := &store.User{
		ID:    newID(),
		Email: req.Email,
		Name:  req.Name,
		Role:  "owner",
	}
	if hasPassword {
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not create account")
			return
		}
		user.PasswordHash = hash
	}
	if err := s.db.CreateUser(r.Context(), user); err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			writeError(w, http.StatusConflict, "email_taken", "an account with this email already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not create account")
		return
	}

	workspace := &store.Workspace{
		ID:   newID(),
		Name: req.Name + "'s workspace",
	}
	if err := s.db.WithTx(r.Context(), func(tx *sqlx.Tx) error {
		if _, err := tx.ExecContext(r.Context(), `INSERT INTO workspaces (id, name) VALUES (?, ?)`, workspace.ID, workspace.Name); err != nil {
			return err
		}
		if _, err := tx.ExecContext(r.Context(), `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)`, workspace.ID, user.ID, "owner"); err != nil {
			return err
		}
		return nil
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create workspace")
		return
	}

	// Email a verification link. When the user registered without a password
	// the verification link doubles as the "set your password" flow.
	if err := s.sendEmailVerification(r.Context(), user); err != nil {
		log.Printf("httpapi: verification email to %s failed: %v", user.Email, err)
	}

	// Passwordless registrations return a message instead of a session — the
	// user must verify their email and set a password first.
	if !hasPassword {
		writeJSON(w, http.StatusCreated, map[string]string{
			"message": "Check your email to verify your account and set your password",
		})
		return
	}

	s.issueSessionToken(r.Context(), w, user, workspace.ID, r, s.cfg.TokenTTL, http.StatusCreated)
}

// hashPassword is a thin wrapper around auth.HashPassword used by both
// registration and the set-password flow.
func hashPassword(password string) (string, error) {
	return auth.HashPassword(password)
}
