package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
	role, _, ok := normalizeRole(req.Role)
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "validation", "invalid role")
		return
	}

	if _, err := s.db.WorkspaceMemberByEmail(r.Context(), claims.GetWorkspaceID(), req.Email); err == nil {
		writeError(w, http.StatusConflict, "already_member", "this email is already a member")
		return
	}

	inv := &store.Invitation{
		ID:          newID(),
		WorkspaceID: claims.GetWorkspaceID(),
		Email:       req.Email,
		Role:        role,
		Status:      "pending",
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
	role, label, ok := normalizeRole(req.Role)
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "validation", "invalid role")
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
	s.sendMemberEmail(w, r, inv.Email, "invite")
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
	s.sendMemberEmail(w, r, member.Email, "reminder")
}

func (s *Server) sendMemberEmail(w http.ResponseWriter, r *http.Request, to, kind string) {
	claims := claimsFrom(r)
	ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not send email")
		return
	}
	if s.engine == nil {
		writeError(w, http.StatusBadGateway, "not_configured", "email sending is not configured")
		return
	}
	subject := fmt.Sprintf("You're invited to %s on Mailgeko", ws.Name)
	body := fmt.Sprintf("You've been invited to join %s on Mailgeko.\n\nClick the button below to sign in and get started.", ws.Name)
	if kind == "reminder" {
		subject = fmt.Sprintf("Quick check-in from %s on Mailgeko", ws.Name)
		body = fmt.Sprintf("Just a reminder that %s uses Mailgeko for email marketing. Sign in to stay on top of your campaigns.", ws.Name)
	}
	result, err := s.engine.SendMemberEmail(r.Context(), ws, to, subject, body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "send_failed", "could not send email: "+err.Error())
		return
	}
	writeOK(w, map[string]any{"messageId": result.MessageID, "email": to})
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
