package httpapi

import (
	"net/http"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil || s.session == nil {
		writeOK(w, map[string]bool{"ok": true})
		return
	}

	if err := s.session.Blacklist(r.Context(), claims.GetTokenID(), s.cfg.TokenTTL); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not sign out")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func userResponse(u *store.User) map[string]any {
	return map[string]any{
		"id":               u.ID,
		"email":            u.Email,
		"name":             u.Name,
		"role":             u.Role,
		"avatarUrl":        u.AvatarURL,
		"twoFactorEnabled": u.TOTPEnabled,
		"emailVerified":    u.EmailVerifiedAt != nil,
	}
}
