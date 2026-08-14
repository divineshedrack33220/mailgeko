package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
)

const apiKeyPrefix = "mgk_"

// apiKeyScopeRoutes maps a path prefix to the scope required to touch it.
// Matching is prefix-based and order-independent (a route matches if the
// request path starts with the prefix).
var apiKeyScopeRoutes = []struct {
	prefix string
	scope  string
}{
	{"/api/v1/campaigns", "campaigns:write"},
	{"/api/v1/templates", "templates:write"},
	{"/api/v1/automations", "automations:write"},
	{"/api/v1/contacts", "contacts:write"},
	{"/api/v1/lists", "contacts:write"},
	{"/api/v1/segments", "contacts:write"},
	{"/api/v1/tags", "contacts:write"},
	{"/api/v1/analytics/", "analytics:read"},
}

// apiKeyBlockedPrefixes are user-account endpoints that API keys must never
// reach (they operate on a session user or alter workspace identity/settings,
// which an API key does not have).
var apiKeyBlockedPrefixes = []string{
	"/api/v1/auth/",
	"/api/v1/me",
	"/api/v1/api-keys",
	"/api/v1/notifications",
	"/api/v1/billing",
	"/api/v1/workspace",
	"/api/v1/ai/",
}

// apiKeyFromRequest extracts an API key from either the X-API-Key header or an
// Authorization: Bearer token, but only when the value looks like one of ours
// (mgk_ prefix). It returns "" when the request carries no API key, so JWT
// auth takes over.
func apiKeyFromRequest(r *http.Request) string {
	if k := strings.TrimSpace(r.Header.Get("X-API-Key")); k != "" {
		return k
	}
	token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if strings.HasPrefix(token, apiKeyPrefix) {
		return token
	}
	return ""
}

func (s *Server) authenticateAPIKey(r *http.Request, secret string) (*auth.Claims, bool) {
	sum := sha256.Sum256([]byte(secret))
	key, err := s.db.GetAPIKeyByHash(r.Context(), hex.EncodeToString(sum[:]))
	if err != nil || key == nil {
		return nil, false
	}
	s.db.TouchAPIKeyLastUsed(context.Background(), key.ID)
	return &auth.Claims{
		UserID:      key.ID,
		Email:       "api@" + key.Prefix,
		WorkspaceID: key.WorkspaceID,
		Role:        "api",
		Scopes:      key.Scopes,
	}, true
}

func (s *Server) apiKeyAllowed(r *http.Request, claims *auth.Claims) bool {
	path := r.URL.Path
	for _, blocked := range apiKeyBlockedPrefixes {
		if strings.HasPrefix(path, blocked) {
			return false
		}
	}
	if claims == nil {
		return true
	}

	// Keys created without explicit scopes keep full access for backwards
	// compatibility; keys with scopes are restricted to those scopes.
	if len(claims.Scopes) == 0 {
		return true
	}
	required := ""
	for _, route := range apiKeyScopeRoutes {
		if strings.HasPrefix(path, route.prefix) {
			required = route.scope
			break
		}
	}
	if required == "" {
		// A scoped key may only reach endpoints mapped to one of its scopes.
		// Unmapped endpoints are denied rather than silently granting full
		// access to whatever route falls through.
		return false
	}
	for _, scope := range claims.Scopes {
		if scope == required {
			return true
		}
	}
	return false
}
