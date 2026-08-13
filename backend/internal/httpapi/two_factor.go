package httpapi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"net"
	"net/http"
	"time"

	"github.com/boombuler/barcode/qr"
	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type setupTwoFactorResponse struct {
	Secret     string `json:"secret"`
	OTPAuthURL string `json:"otpauthUrl"`
	QrPNG      string `json:"qrPng"`
}

// handle2FASetup provisions a TOTP secret and returns it alongside a QR code.
// The secret is stored but not yet active until the user verifies a code.
func (s *Server) handle2FASetup(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load profile")
		return
	}
	if user.TOTPEnabled {
		writeError(w, http.StatusConflict, "already_enabled", "two-factor authentication is already enabled")
		return
	}

	secret, otpauthURL, err := auth.GenerateTOTPSecret("Mailgeko", user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate secret")
		return
	}
	if err := s.db.SaveTOTPSecret(r.Context(), user.ID, secret); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not save secret")
		return
	}

	writeOK(w, setupTwoFactorResponse{
		Secret:     secret,
		OTPAuthURL: otpauthURL,
		QrPNG:      qrPNGDataURL(otpauthURL),
	})
}

type enableTwoFactorRequest struct {
	Code string `json:"code"`
}

// handle2FAEnable verifies the user's first code and activates two-factor auth.
func (s *Server) handle2FAEnable(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	var req enableTwoFactorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load profile")
		return
	}
	if user.TOTPEnabled {
		writeError(w, http.StatusConflict, "already_enabled", "two-factor authentication is already enabled")
		return
	}
	if user.TOTPSecret == "" || !auth.ValidateTOTP(req.Code, user.TOTPSecret) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_code", "the verification code is invalid or expired")
		return
	}

	codes, err := auth.GenerateRecoveryCodes(8)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate recovery codes")
		return
	}
	codesJSON, err := json.Marshal(auth.HashRecoveryCodes(codes))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not store recovery codes")
		return
	}
	if err := s.db.EnableTOTP(r.Context(), user.ID, user.TOTPSecret, string(codesJSON)); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not enable two-factor authentication")
		return
	}

	writeOK(w, map[string]any{"recoveryCodes": codes})
}

type disableTwoFactorRequest struct {
	Code string `json:"code"`
}

// handle2FADisable requires a current code, then turns two-factor off.
func (s *Server) handle2FADisable(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	var req disableTwoFactorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load profile")
		return
	}
	if !user.TOTPEnabled {
		writeError(w, http.StatusConflict, "not_enabled", "two-factor authentication is not enabled")
		return
	}
	if !auth.ValidateTOTP(req.Code, user.TOTPSecret) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_code", "the verification code is invalid or expired")
		return
	}
	if err := s.db.DisableTOTP(r.Context(), user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not disable two-factor authentication")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

// handle2FARegenerateCodes replaces the user's recovery codes (codes are shown once).
func (s *Server) handle2FARegenerateCodes(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load profile")
		return
	}
	if !user.TOTPEnabled {
		writeError(w, http.StatusConflict, "not_enabled", "two-factor authentication is not enabled")
		return
	}
	codes, err := auth.GenerateRecoveryCodes(8)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate recovery codes")
		return
	}
	codesJSON, err := json.Marshal(auth.HashRecoveryCodes(codes))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not store recovery codes")
		return
	}
	if err := s.db.UpdateRecoveryCodes(r.Context(), user.ID, string(codesJSON)); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update recovery codes")
		return
	}
	writeOK(w, map[string]any{"recoveryCodes": codes})
}

type verifyTwoFactorRequest struct {
	PendingToken string `json:"pendingToken"`
	Code         string `json:"code"`
}

// handleVerifyTwoFactor completes a login that was paused for a second factor.
func (s *Server) handleVerifyTwoFactor(w http.ResponseWriter, r *http.Request) {
	var req verifyTwoFactorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	claims, err := s.tokens.Parse(req.PendingToken)
	if err != nil || !claims.Pending {
		writeError(w, http.StatusUnauthorized, "unauthorized", "session challenge expired, sign in again")
		return
	}

	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "sign in again")
		return
	}
	if !user.TOTPEnabled {
		writeError(w, http.StatusConflict, "not_enabled", "two-factor authentication is not enabled")
		return
	}

	verified := auth.ValidateTOTP(req.Code, user.TOTPSecret)
	if !verified && user.TOTPRecovery != "" {
		// Use a Redis lock to prevent TOCTOU race on recovery code consumption.
		// Without this, two concurrent logins could both consume the same code.
		lockKey := "recovery_lock:" + user.ID
		locked, _ := s.session.rdb.SetNX(context.Background(), lockKey, "1", 10*time.Second).Result()
		if locked {
			var matched bool
			var remaining []string
			matched, remaining = auth.ConsumeRecoveryCode(req.Code, user.TOTPRecovery)
			if matched {
				if len(remaining) > 0 {
					if raw, err := json.Marshal(remaining); err == nil {
						_ = s.db.UpdateRecoveryCodes(r.Context(), user.ID, string(raw))
					}
				} else {
					_ = s.db.UpdateRecoveryCodes(r.Context(), user.ID, "[]")
				}
				verified = true
			}
			_ = s.session.rdb.Del(context.Background(), lockKey).Err()
		}
	}
	if !verified {
		writeError(w, http.StatusUnprocessableEntity, "invalid_code", "the verification code is invalid or expired")
		return
	}

	workspaceID, err := s.db.WorkspaceIDForUser(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not sign in")
		return
	}
	ttl := s.cfg.TokenTTL
	if claims.SessionTTL > 0 {
		ttl = time.Duration(claims.SessionTTL) * time.Second
	}
	s.issueSessionToken(r.Context(), w, user, workspaceID, r, ttl, http.StatusOK)
}

// issueSessionToken issues a real session token, records it in the session
// store, and writes the standard auth response.
func (s *Server) issueSessionToken(ctx context.Context, w http.ResponseWriter, user *store.User, workspaceID string, r *http.Request, ttl time.Duration, status int) bool {
	token, err := s.tokens.IssueWithTTL(user.ID, user.Email, workspaceID, user.Role, ttl)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create session")
		return false
	}
	s.recordSession(r.Context(), token, r, ttl)
	writeJSON(w, status, map[string]any{
		"token":       token,
		"user":        userResponse(user),
		"workspaceID": workspaceID,
		"role":        s.roleForWorkspace(ctx, workspaceID, user.ID),
	})
	return true
}

// roleForWorkspace returns the caller's role within the given workspace, or an
// empty string if the membership cannot be resolved.
func (s *Server) roleForWorkspace(ctx context.Context, workspaceID, userID string) string {
	role, err := s.db.WorkspaceMemberByUserID(ctx, workspaceID, userID)
	if err != nil {
		return ""
	}
	return role
}

// recordSession stores the issued token as an active session record.
func (s *Server) recordSession(ctx context.Context, token string, r *http.Request, ttl time.Duration) {
	if s.session == nil {
		return
	}
	claims, err := s.tokens.Parse(token)
	if err != nil {
		return
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	_ = s.session.Create(ctx, claims.GetUserID(), claims.GetTokenID(), deviceFromUserAgent(r.UserAgent()), ip, ip, ttl)
}

// qrPNGDataURL renders an otpauth URL as a base64 data URL PNG.
func qrPNGDataURL(otpauthURL string) string {
	code, err := qr.Encode(otpauthURL, qr.M, qr.Auto)
	if err != nil {
		return ""
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, code); err != nil {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}
