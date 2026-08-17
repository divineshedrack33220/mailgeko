package httpapi

import (
	"net/http"
	"time"
)

const sessionCookieName = "mailgeko_session"

// setSessionCookie writes the JWT as an httpOnly, SameSite=Lax cookie so the
// browser sends it automatically on subsequent requests. The cookie is cleared
// on logout.
func (s *Server) setSessionCookie(w http.ResponseWriter, token string, ttl time.Duration) {
	secure := s.cfg.Env == "production" || s.cfg.Env == "staging"
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(ttl.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	})
}

// clearSessionCookie expires the session cookie immediately.
func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	secure := s.cfg.Env == "production" || s.cfg.Env == "staging"
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	})
}

// tokenFromRequest extracts the JWT from either the Authorization header or the
// session cookie. The Authorization header takes precedence so API keys and CLI
// tools continue to work.
func tokenFromRequest(r *http.Request) string {
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		token := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		}
		if token != "" {
			return token
		}
	}
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		return cookie.Value
	}
	return ""
}

// hasSessionCookie reports whether the request carries the session cookie.
// Used to scope CSRF checks to cookie-authenticated requests only.
func hasSessionCookie(r *http.Request) bool {
	cookie, err := r.Cookie(sessionCookieName)
	return err == nil && cookie.Value != ""
}
