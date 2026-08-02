package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-sql-driver/mysql"

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
	if len(req.Password) < 8 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "password must be at least 8 characters")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}

	if _, err := s.db.UserByEmail(r.Context(), req.Email); err == nil {
		writeError(w, http.StatusConflict, "email_taken", "an account with this email already exists")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create account")
		return
	}

	user := &store.User{
		ID:           newID(),
		Email:        req.Email,
		PasswordHash: hash,
		Name:         req.Name,
		Role:         "owner",
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
	if err := s.db.CreateWorkspace(r.Context(), workspace); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create workspace")
		return
	}
	if err := s.db.AddWorkspaceMember(r.Context(), workspace.ID, user.ID, "owner"); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create workspace")
		return
	}

	s.issueSessionToken(r.Context(), w, user, workspace.ID, r, http.StatusCreated)
}
