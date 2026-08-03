package httpapi

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type verifyEmailRequest struct {
	Token string `json:"token"`
}

// handleForgotPassword issues a password-reset link and emails it to the
// user. It always reports success so the endpoint cannot be used to enumerate
// registered email addresses.
func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	user, err := s.db.UserByEmail(r.Context(), req.Email)
	if err != nil {
		writeOK(w, map[string]bool{"ok": true})
		return
	}
	// OAuth-only accounts have no password to reset.
	if user.PasswordHash == "" {
		writeOK(w, map[string]bool{"ok": true})
		return
	}

	if err := s.sendPasswordReset(r.Context(), user); err != nil {
		log.Printf("httpapi: password reset email to %s failed: %v", user.Email, err)
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "password must be at least 8 characters")
		return
	}

	claims, err := s.tokens.Parse(req.Token)
	if err != nil || claims.Purpose != auth.PurposePasswordReset {
		writeError(w, http.StatusBadRequest, "invalid_token", "this reset link is invalid or expired")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil || user.Email != claims.GetEmail() {
		writeError(w, http.StatusBadRequest, "invalid_token", "this reset link is invalid or expired")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update password")
		return
	}
	if err := s.db.SetPasswordHash(r.Context(), user.ID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update password")
		return
	}
	// Revoke every existing session so other devices must sign in again.
	if s.session != nil {
		_ = s.session.RevokeAllExcept(r.Context(), user.ID, "", s.cfg.TokenTTL)
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req verifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}

	claims, err := s.tokens.Parse(req.Token)
	if err != nil || claims.Purpose != auth.PurposeEmailVerification {
		writeError(w, http.StatusBadRequest, "invalid_token", "this verification link is invalid or expired")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil || user.Email != claims.GetEmail() {
		writeError(w, http.StatusBadRequest, "invalid_token", "this verification link is invalid or expired")
		return
	}
	if err := s.db.MarkEmailVerified(r.Context(), user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not verify email")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

// handleResendVerification emails a new verification link to the signed-in
// user.
func (s *Server) handleResendVerification(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	if user.EmailVerifiedAt != nil {
		writeError(w, http.StatusConflict, "already_verified", "your email is already verified")
		return
	}
	if err := s.sendEmailVerification(r.Context(), user); err != nil {
		log.Printf("httpapi: verification email to %s failed: %v", user.Email, err)
		writeError(w, http.StatusInternalServerError, "email_failed", "could not send the verification email")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

// sendEmailVerification issues a verification link and emails it to the user.
func (s *Server) sendEmailVerification(ctx context.Context, user *store.User) error {
	token, err := s.tokens.IssueEmailVerification(user.ID, user.Email)
	if err != nil {
		return err
	}
	link := s.cfg.BaseURL + "/verify-email?token=" + url.QueryEscape(token)
	_, err = s.engine.SendEmailVerification(ctx, user.Email, user.Name, link)
	return err
}

// sendPasswordReset issues a password-reset link and emails it to the user.
func (s *Server) sendPasswordReset(ctx context.Context, user *store.User) error {
	token, err := s.tokens.IssuePasswordReset(user.ID, user.Email)
	if err != nil {
		return err
	}
	link := s.cfg.BaseURL + "/reset-password?token=" + url.QueryEscape(token)
	_, err = s.engine.SendPasswordReset(ctx, user.Email, user.Name, link)
	return err
}
