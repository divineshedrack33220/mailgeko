package httpapi

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/sender"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type smtpRequest struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	FromName  string `json:"fromName"`
	FromEmail string `json:"fromEmail"`
	ReplyTo   string `json:"replyTo"`
	Enabled   bool   `json:"enabled"`
}

// smtpAvailable reports whether BYO-SMTP is enabled on this deployment
// (requires MAILGEKO_SECRET_KEY on both the api and worker processes).
func (s *Server) smtpAvailable() bool {
	return s.engine != nil && s.engine.Encryptor() != nil
}

func (s *Server) handleGetSMTP(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	cfg, err := s.db.GetWorkspaceSMTP(r.Context(), claims.GetWorkspaceID())
	if err == sql.ErrNoRows {
		writeOK(w, map[string]any{
			"configured": false,
			"enabled":    false,
			"available":  s.smtpAvailable(),
		})
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load smtp settings")
		return
	}
	writeOK(w, map[string]any{
		"configured":  true,
		"available":   s.smtpAvailable(),
		"host":        cfg.Host,
		"port":        cfg.Port,
		"username":    cfg.Username,
		"hasPassword": len(cfg.PasswordCipher) > 0,
		"fromName":    cfg.FromName,
		"fromEmail":   cfg.FromEmail,
		"replyTo":     cfg.ReplyTo,
		"enabled":     cfg.Enabled,
	})
}

func (s *Server) handleUpsertSMTP(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	if !s.smtpAvailable() {
		writeError(w, http.StatusServiceUnavailable, "smtp_disabled", "bring-your-own SMTP is not enabled on this deployment")
		return
	}
	var req smtpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Host = strings.TrimSpace(req.Host)
	req.Username = strings.TrimSpace(req.Username)
	req.FromName = strings.TrimSpace(req.FromName)
	req.FromEmail = strings.TrimSpace(req.FromEmail)
	req.ReplyTo = strings.TrimSpace(req.ReplyTo)

	if req.Host == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "smtp host is required")
		return
	}
	if req.Port != 465 && req.Port != 587 && req.Port != 25 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "port must be 465, 587 or 25")
		return
	}
	if req.Username == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "smtp username is required")
		return
	}
	if req.FromEmail != "" && !strings.Contains(req.FromEmail, "@") {
		writeError(w, http.StatusUnprocessableEntity, "validation", "a valid sender email is required")
		return
	}

	workspaceID := claims.GetWorkspaceID()
	var cipher []byte
	if req.Password != "" {
		enc := s.engine.Encryptor()
		encrypted, err := enc.Encrypt([]byte(req.Password))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not encrypt smtp password")
			return
		}
		cipher = encrypted
	} else {
		if existing, err := s.db.GetWorkspaceSMTP(r.Context(), workspaceID); err == nil {
			cipher = existing.PasswordCipher
		}
	}
	if len(cipher) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "smtp password is required")
		return
	}

	fromEmail := req.FromEmail
	if fromEmail == "" {
		fromEmail = req.Username
	}

	cfg := &store.WorkspaceSMTP{
		WorkspaceID:    workspaceID,
		Host:           req.Host,
		Port:           req.Port,
		Username:       req.Username,
		PasswordCipher: cipher,
		FromName:       req.FromName,
		FromEmail:      fromEmail,
		ReplyTo:        req.ReplyTo,
		Enabled:        req.Enabled,
	}
	if err := s.db.UpsertWorkspaceSMTP(r.Context(), cfg); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not save smtp settings")
		return
	}
	writeOK(w, map[string]any{
		"configured":  true,
		"host":        cfg.Host,
		"port":        cfg.Port,
		"username":    cfg.Username,
		"hasPassword": len(cfg.PasswordCipher) > 0,
		"fromName":    cfg.FromName,
		"fromEmail":   cfg.FromEmail,
		"replyTo":     cfg.ReplyTo,
		"enabled":     cfg.Enabled,
	})
}

func (s *Server) handleDeleteSMTP(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	if err := s.db.DeleteWorkspaceSMTP(r.Context(), claims.GetWorkspaceID()); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not remove smtp settings")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

// handleTestSMTP sends a probe email through the supplied (or stored) SMTP
// config to the requesting member, validating credentials before they are
// enabled.
func (s *Server) handleTestSMTP(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	if !s.smtpAvailable() {
		writeError(w, http.StatusServiceUnavailable, "smtp_disabled", "bring-your-own SMTP is not enabled on this deployment")
		return
	}
	var req smtpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	workspaceID := claims.GetWorkspaceID()
	password := req.Password
	if password == "" {
		if existing, err := s.db.GetWorkspaceSMTP(r.Context(), workspaceID); err == nil {
			if dec, err := s.engine.Encryptor().Decrypt(existing.PasswordCipher); err == nil {
				password = string(dec)
			}
		}
	}

	fromEmail := strings.TrimSpace(req.FromEmail)
	if fromEmail == "" {
		fromEmail = strings.TrimSpace(req.Username)
	}
	from := smtpFromString(strings.TrimSpace(req.FromName), fromEmail)

	client := sender.NewSMTPClient(sender.SMTPConfig{
		Host:      req.Host,
		Port:      req.Port,
		Username:  req.Username,
		Password:  password,
		FromName:  req.FromName,
		FromEmail: fromEmail,
		ReplyTo:   req.ReplyTo,
	})
	_, err := client.Send(r.Context(), sender.Message{
		From:    from,
		To:      claims.GetEmail(),
		Subject: "Mailgeko SMTP test",
		HTML:    "<p>If you're reading this, your SMTP settings work.</p>",
		Text:    "If you're reading this, your SMTP settings work.",
	})
	if err != nil {
		log.Printf("smtp test failed: %v", err)
		writeError(w, http.StatusBadRequest, "smtp_test_failed", "SMTP connection failed — check host, port, and credentials")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func smtpFromString(name, email string) string {
	if name != "" && email != "" {
		return name + " <" + email + ">"
	}
	return email
}
