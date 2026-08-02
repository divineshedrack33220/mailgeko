package httpapi

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/oauth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

const oauthStateCookie = "mailgeko_oauth_state"

func (s *Server) handleOAuthStart(provider oauth.Provider) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.oauth == nil || !s.oauth.Enabled(provider) {
			s.oauthRedirectError(w, r, "not_configured")
			return
		}

		state, err := oauthState()
		if err != nil {
			s.oauthRedirectError(w, r, "internal")
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     oauthStateCookie,
			Value:    state,
			Path:     "/",
			MaxAge:   600,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   s.cfg.Env == "production",
		})

		authURL, err := s.oauth.AuthCodeURL(provider, state)
		if err != nil {
			s.oauthRedirectError(w, r, "not_configured")
			return
		}
		http.Redirect(w, r, authURL, http.StatusFound)
	}
}

func (s *Server) handleOAuthCallback(provider oauth.Provider) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.oauth == nil || !s.oauth.Enabled(provider) {
			s.oauthRedirectError(w, r, "not_configured")
			return
		}

		cookie, err := r.Cookie(oauthStateCookie)
		if err != nil || cookie.Value == "" || cookie.Value != r.URL.Query().Get("state") {
			s.oauthRedirectError(w, r, "invalid_state")
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			s.oauthRedirectError(w, r, "no_code")
			return
		}

		token, err := s.oauth.Exchange(r.Context(), provider, code)
		if err != nil {
			s.oauthRedirectError(w, r, "exchange_failed")
			return
		}

		ident, err := s.oauth.FetchIdentity(r.Context(), provider, token)
		if err != nil {
			s.oauthRedirectError(w, r, "profile_failed")
			return
		}

		user, workspaceID, err := s.oauthUpsert(r, ident)
		if err != nil {
			s.oauthRedirectError(w, r, "internal")
			return
		}

		jwt, err := s.tokens.Issue(user.ID, user.Email, workspaceID, user.Role)
		if err != nil {
			s.oauthRedirectError(w, r, "internal")
			return
		}

		http.Redirect(w, r, s.cfg.BaseURL+"/oauth/callback?token="+jwt, http.StatusFound)
	}
}

// oauthUpsert finds the user by email or creates them (plus a default
// workspace) and links the OAuth identity.
func (s *Server) oauthUpsert(r *http.Request, ident *oauth.Identity) (*store.User, string, error) {
	ctx := r.Context()
	email := strings.ToLower(ident.Email)

	user, err := s.db.UserByEmail(ctx, email)
	switch {
	case err == nil:
	case errors.Is(err, sql.ErrNoRows):
		user = &store.User{
			ID:            newID(),
			Email:         email,
			Name:          ident.Name,
			Role:          "owner",
			OAuthProvider: string(ident.Provider),
			OAuthUID:      ident.ProviderUID,
		}
		if err := s.db.CreateUser(ctx, user); err != nil {
			return nil, "", err
		}
		ws := &store.Workspace{ID: newID(), Name: workspaceNameFor(ident.Name, email)}
		if err := s.db.CreateWorkspace(ctx, ws); err != nil {
			return nil, "", err
		}
		if err := s.db.AddWorkspaceMember(ctx, ws.ID, user.ID, "owner"); err != nil {
			return nil, "", err
		}
	default:
		return nil, "", err
	}

	if user.OAuthProvider == "" || user.OAuthUID == "" {
		if err := s.db.UpdateUserOAuth(ctx, user.ID, string(ident.Provider), ident.ProviderUID); err != nil {
			return nil, "", err
		}
	}
	if user.Name == "" && ident.Name != "" {
		if err := s.db.UpdateUserName(ctx, user.ID, ident.Name); err != nil {
			return nil, "", err
		}
		user.Name = ident.Name
	}

	workspaceID, err := s.db.WorkspaceIDForUser(ctx, user.ID)
	if err != nil {
		return nil, "", err
	}
	return user, workspaceID, nil
}

func workspaceNameFor(name, email string) string {
	if name != "" {
		return name + "'s workspace"
	}
	at := strings.Index(email, "@")
	if at > 0 {
		return email[:at] + "'s workspace"
	}
	return "My workspace"
}

func (s *Server) oauthRedirectError(w http.ResponseWriter, r *http.Request, code string) {
	http.Redirect(w, r, s.cfg.BaseURL+"/oauth/callback?error="+code, http.StatusFound)
}

func oauthState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
