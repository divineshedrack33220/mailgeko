package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

var validRoles = map[string]string{
	"owner":   "Owner",
	"admin":   "Admin",
	"manager": "Manager",
	"viewer":  "Viewer",
}

func normalizeRole(role string) (string, string, bool) {
	role = strings.ToLower(strings.TrimSpace(role))
	label, ok := validRoles[role]
	return role, label, ok
}

func normalizeAssignableRole(role string) (string, string, bool) {
	role, label, ok := normalizeRole(role)
	if !ok || role == "owner" {
		return "", "", false
	}
	return role, label, true
}

func (s *Server) handleListWorkspaceMembers(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	workspaceID := claims.GetWorkspaceID()

	members, err := s.db.ListWorkspaceMembers(r.Context(), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list team members")
		return
	}
	invites, err := s.db.ListInvitations(r.Context(), workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list invitations")
		return
	}

	out := make([]map[string]any, 0, len(members)+len(invites))
	for _, m := range members {
		_, label, _ := normalizeRole(m.Role)
		item := map[string]any{
			"id":     m.ID,
			"name":   m.Name,
			"email":  m.Email,
			"role":   label,
			"status": "active",
		}
		if m.LastActive != nil {
			item["lastActive"] = m.LastActive.UTC().Format(time.RFC3339)
		}
		out = append(out, item)
	}
	for _, inv := range invites {
		_, label, _ := normalizeRole(inv.Role)
		out = append(out, map[string]any{
			"id":         inv.ID,
			"name":       "",
			"email":      inv.Email,
			"role":       label,
			"status":     "invited",
			"invitedAt":  inv.CreatedAt.UTC().Format(time.RFC3339),
			"invitation": true,
		})
	}

	writeOK(w, map[string]any{"members": out})
}

func (s *Server) handleInviteWorkspaceMember(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		writeError(w, http.StatusUnprocessableEntity, "validation", "a valid email is required")
		return
	}
	role, _, ok := normalizeAssignableRole(req.Role)
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "validation", "only admin, manager, or viewer roles can be assigned")
		return
	}

	if _, err := s.db.WorkspaceMemberByEmail(r.Context(), claims.GetWorkspaceID(), req.Email); err == nil {
		writeError(w, http.StatusConflict, "already_member", "this email is already a member")
		return
	}

	token, tokenHash := newInviteToken()
	now := time.Now()
	inv := &store.Invitation{
		ID:          newID(),
		WorkspaceID: claims.GetWorkspaceID(),
		Email:       req.Email,
		Role:        role,
		Status:      "pending",
		TokenHash:   sql.NullString{String: tokenHash, Valid: true},
		ExpiresAt:   sql.NullTime{Time: now.Add(inviteTTL), Valid: true},
	}
	if err := s.db.CreateInvitation(r.Context(), inv); err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			writeError(w, http.StatusConflict, "already_invited", "this email already has a pending invitation")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not create invitation")
		return
	}

	link := s.inviteLink(token)
	if err := s.sendMemberEmail(r, req.Email, "invite", link); err != nil {
		writeMemberEmailError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"invitation": invitationResponse(inv),
	})
}

func (s *Server) handleUpdateWorkspaceMember(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	id := r.PathValue("id")
	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	role, label, ok := normalizeAssignableRole(req.Role)
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "validation", "only admin, manager, or viewer roles can be assigned")
		return
	}

	if memberRole, err := s.db.WorkspaceMemberByUserID(r.Context(), claims.GetWorkspaceID(), id); err == nil {
		if memberRole == "owner" {
			writeError(w, http.StatusUnprocessableEntity, "validation", "the workspace owner's role cannot be changed")
			return
		}
		if err := s.db.UpdateMemberRole(r.Context(), claims.GetWorkspaceID(), id, role); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not update member role")
			return
		}
		writeOK(w, map[string]any{"member": map[string]any{"id": id, "role": label}})
		return
	}
	if inv, err := s.db.InvitationByID(r.Context(), claims.GetWorkspaceID(), id); err == nil {
		if err := s.db.UpdateInvitationRole(r.Context(), claims.GetWorkspaceID(), id, role); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not update invitation role")
			return
		}
		writeOK(w, map[string]any{"member": map[string]any{"id": id, "role": label, "email": inv.Email, "invitation": true}})
		return
	}
	writeError(w, http.StatusNotFound, "not_found", "member not found")
}

func (s *Server) handleRemoveWorkspaceMember(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	id := r.PathValue("id")

	if id == claims.GetUserID() {
		writeError(w, http.StatusUnprocessableEntity, "validation", "you cannot remove yourself from the workspace")
		return
	}

	if memberRole, err := s.db.WorkspaceMemberByUserID(r.Context(), claims.GetWorkspaceID(), id); err == nil {
		if memberRole == "owner" {
			writeError(w, http.StatusUnprocessableEntity, "validation", "the workspace owner cannot be removed")
			return
		}
		if err := s.db.DeleteWorkspaceMember(r.Context(), claims.GetWorkspaceID(), id); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not remove member")
			return
		}
		writeOK(w, map[string]bool{"ok": true})
		return
	}
	if _, err := s.db.InvitationByID(r.Context(), claims.GetWorkspaceID(), id); err == nil {
		if err := s.db.DeleteInvitation(r.Context(), claims.GetWorkspaceID(), id); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not remove invitation")
			return
		}
		writeOK(w, map[string]bool{"ok": true})
		return
	}
	writeError(w, http.StatusNotFound, "not_found", "member not found")
}

func (s *Server) handleResendInvitation(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	inv, err := s.db.InvitationByID(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "invitation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not resend invitation")
		return
	}
	if inv.Status != "pending" {
		writeError(w, http.StatusConflict, "not_pending", "this invitation is no longer pending")
		return
	}
	token, tokenHash := newInviteToken()
	now := time.Now()
	inv.TokenHash = sql.NullString{String: tokenHash, Valid: true}
	inv.ExpiresAt = sql.NullTime{Time: now.Add(inviteTTL), Valid: true}
	if err := s.db.UpdateInvitationToken(r.Context(), claims.GetWorkspaceID(), inv.ID, tokenHash, inv.ExpiresAt); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not refresh invitation")
		return
	}
	if err := s.sendMemberEmail(r, inv.Email, "invite", s.inviteLink(token)); err != nil {
		writeMemberEmailError(w, err)
		return
	}
	writeOK(w, map[string]any{"ok": true, "email": inv.Email})
}

func (s *Server) handleSendMemberReminder(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	id := r.PathValue("id")
	if id == claims.GetUserID() {
		writeError(w, http.StatusUnprocessableEntity, "validation", "you cannot send a reminder to yourself")
		return
	}
	members, err := s.db.ListWorkspaceMembers(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not send reminder")
		return
	}
	var member *store.Member
	for i := range members {
		if members[i].ID == id {
			member = &members[i]
			break
		}
	}
	if member == nil {
		writeError(w, http.StatusNotFound, "not_found", "member not found")
		return
	}
	if err := s.sendMemberEmail(r, member.Email, "reminder", ""); err != nil {
		writeMemberEmailError(w, err)
		return
	}
	writeOK(w, map[string]any{"ok": true, "email": member.Email})
}

// writeMemberEmailError maps a failed member-email send to an HTTP response.
func writeMemberEmailError(w http.ResponseWriter, err error) {
	if errors.Is(err, errEmailNotConfigured) {
		writeError(w, http.StatusBadGateway, "not_configured", "email sending is not configured")
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "internal", "could not send email")
		return
	}
	writeError(w, http.StatusBadGateway, "send_failed", "could not send email: "+err.Error())
}

// inviteTTL is how long an invitation link stays redeemable.
const inviteTTL = 7 * 24 * time.Hour

// newInviteToken returns a random URL-safe token and its SHA-256 hex hash.
// Only the hash is stored so a leaked database cannot be used to forge links.
func newInviteToken() (token, tokenHash string) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		panic("httpapi: could not generate invite token: " + err.Error())
	}
	token = hex.EncodeToString(buf)
	sum := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(sum[:])
}

func (s *Server) inviteLink(token string) string {
	return s.cfg.BaseURL + "/invite?token=" + url.QueryEscape(token)
}

func inviteEmailBody(workspaceName, link string) string {
	name := html.EscapeString(workspaceName)
	return fmt.Sprintf(
		"<p>You've been invited to join <strong>%s</strong> on Mailgeko.</p>"+
			"<p style=\"margin:20px 0\"><a href=\"%s\" style=\"display:inline-block;background:#007e4f;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:8px\">Accept invitation</a></p>"+
			"<p style=\"color:#6b7280;font-size:13px\">If the button doesn't work, paste this link into your browser:<br/>%s</p>",
		name, link, link)
}

func inviteEmailText(workspaceName, link string) string {
	return fmt.Sprintf(
		"You've been invited to join %s on Mailgeko.\n\nAccept the invitation here:\n%s\n\nThe link expires in 7 days.",
		workspaceName, link)
}

func (s *Server) sendMemberEmail(r *http.Request, to, kind, link string) error {
	claims := claimsFrom(r)
	ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		return err
	}
	if s.engine == nil {
		return errEmailNotConfigured
	}
	var subject, htmlBody, textBody string
	if kind == "invite" {
		subject = fmt.Sprintf("You're invited to %s on Mailgeko", ws.Name)
		htmlBody = inviteEmailBody(ws.Name, link)
		textBody = inviteEmailText(ws.Name, link)
	} else {
		subject = fmt.Sprintf("Quick check-in from %s on Mailgeko", ws.Name)
		htmlBody = fmt.Sprintf("<p>Just a reminder that %s uses Mailgeko for email marketing. Sign in to stay on top of your campaigns.</p>", html.EscapeString(ws.Name))
		textBody = fmt.Sprintf("Just a reminder that %s uses Mailgeko for email marketing. Sign in to stay on top of your campaigns.", ws.Name)
	}
	_, err = s.engine.SendMemberEmail(r.Context(), ws, to, subject, htmlBody, textBody)
	return err
}

var errEmailNotConfigured = errors.New("email sending is not configured")

// handleAcceptInvitation redeems an invitation link for the signed-in user.
// It binds their session to the invited workspace so the app reflects the
// workspace they just joined.
func (s *Server) handleAcceptInvitation(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}
	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "invitation token is required")
		return
	}

	sum := sha256.Sum256([]byte(req.Token))
	inv, err := s.db.InvitationByTokenHash(r.Context(), hex.EncodeToString(sum[:]))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "invitation not found or already used")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not look up invitation")
		return
	}
	if inv.ExpiresAt.Valid && inv.ExpiresAt.Time.Before(time.Now()) {
		writeError(w, http.StatusGone, "expired", "this invitation has expired")
		return
	}
	if !strings.EqualFold(claims.GetEmail(), inv.Email) {
		writeError(w, http.StatusForbidden, "email_mismatch", "this invitation was sent to a different email address")
		return
	}

	if _, err := s.db.GetWorkspace(r.Context(), inv.WorkspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load workspace")
		return
	}

	if _, err := s.db.WorkspaceMemberByUserID(r.Context(), inv.WorkspaceID, claims.GetUserID()); err != nil {
		if err != sql.ErrNoRows {
			writeError(w, http.StatusInternalServerError, "internal", "could not verify membership")
			return
		}
		if err := s.db.AddWorkspaceMember(r.Context(), inv.WorkspaceID, claims.GetUserID(), inv.Role); err != nil {
			var mysqlErr *mysql.MySQLError
			if !(errors.As(err, &mysqlErr) && mysqlErr.Number == 1062) {
				writeError(w, http.StatusInternalServerError, "internal", "could not join workspace")
				return
			}
		}
	}

	if err := s.db.DeleteInvitation(r.Context(), inv.WorkspaceID, inv.ID); err != nil {
		log.Printf("httpapi: could not clear accepted invitation %s: %v", inv.ID, err)
	}

	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load user")
		return
	}
	s.issueSessionToken(r.Context(), w, user, inv.WorkspaceID, r, s.cfg.TokenTTL, http.StatusOK)
}

func invitationResponse(inv *store.Invitation) map[string]any {
	_, label, _ := normalizeRole(inv.Role)
	return map[string]any{
		"id":         inv.ID,
		"email":      inv.Email,
		"role":       label,
		"status":     inv.Status,
		"invitedAt":  inv.CreatedAt.UTC().Format(time.RFC3339),
		"invitation": true,
	}
}

func (s *Server) handleListAPIKeys(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	keys, err := s.db.ListAPIKeys(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list API keys")
		return
	}
	out := make([]map[string]any, 0, len(keys))
	for _, k := range keys {
		item := map[string]any{
			"id":      k.ID,
			"name":    k.Name,
			"prefix":  k.Prefix,
			"scopes":  orEmptySlice(k.Scopes),
			"createdAt": k.CreatedAt.UTC().Format(time.RFC3339),
		}
		if k.LastUsedAt != nil {
			item["lastUsed"] = k.LastUsedAt.UTC().Format(time.RFC3339)
		}
		out = append(out, item)
	}
	writeOK(w, map[string]any{"keys": out})
}

func (s *Server) handleCreateAPIKey(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	var req struct {
		Name   string   `json:"name"`
		Scopes []string `json:"scopes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}

	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not generate API key")
		return
	}
	secret := "mgk_live_" + hex.EncodeToString(buf)
	hash := sha256.Sum256([]byte(secret))
	prefix := secret[:16]

	k := &store.APIKey{
		ID:          newID(),
		WorkspaceID: claims.GetWorkspaceID(),
		Name:        req.Name,
		Prefix:      prefix,
		KeyHash:     hex.EncodeToString(hash[:]),
		Scopes:      req.Scopes,
	}
	if k.Scopes == nil {
		k.Scopes = []string{}
	}
	if err := s.db.CreateAPIKey(r.Context(), k); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not create API key")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"key": map[string]any{
			"id":        k.ID,
			"name":      k.Name,
			"prefix":    k.Prefix,
			"scopes":    k.Scopes,
			"createdAt": k.CreatedAt.UTC().Format(time.RFC3339),
		},
		"secret": secret,
	})
}

func (s *Server) handleDeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	if err := s.db.DeleteAPIKey(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not revoke API key")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleGetNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	rows, err := s.db.NotificationPrefs(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load notification preferences")
		return
	}

	prefs := make(map[string]bool)
	for _, k := range []string{"camp-sent", "camp-scheduled", "camp-failed", "aud-spikes", "aud-bounces", "aud-list", "sec-login", "sec-key", "bill-invoice", "bill-limit"} {
		prefs[k] = rows[k] != "0"
	}
	digest := "weekly"
	if v, ok := rows["digest"]; ok && v != "" {
		digest = v
	}

	writeOK(w, map[string]any{"prefs": prefs, "digest": digest})
}

func (s *Server) handleUpdateNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		Prefs  map[string]bool `json:"prefs"`
		Digest string          `json:"digest"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}

	for key, enabled := range req.Prefs {
		value := "0"
		if enabled {
			value = "1"
		}
		if err := s.db.UpsertNotificationPref(r.Context(), claims.GetUserID(), key, value); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not save notification preferences")
			return
		}
	}
	if req.Digest == "daily" || req.Digest == "weekly" || req.Digest == "never" {
		if err := s.db.UpsertNotificationPref(r.Context(), claims.GetUserID(), "digest", req.Digest); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not save notification preferences")
			return
		}
	}

	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	if err := s.db.UpdateUserName(r.Context(), claims.GetUserID(), req.Name); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update profile")
		return
	}
	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load profile")
		return
	}
	writeOK(w, map[string]any{"user": userResponse(user)})
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if len(req.NewPassword) < 8 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "new password must be at least 8 characters")
		return
	}

	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not change password")
		return
	}
	ok, err := auth.VerifyPassword(req.CurrentPassword, user.PasswordHash)
	if err != nil || !ok {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "current password is incorrect")
		return
	}

	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not change password")
		return
	}
	if err := s.db.UpdateUserPassword(r.Context(), user.ID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not change password")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}
