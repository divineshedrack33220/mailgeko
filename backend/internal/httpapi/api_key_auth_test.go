package httpapi

import (
	"net/http/httptest"
	"testing"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
)

func TestAPIKeyFromRequest(t *testing.T) {
	t.Run("x-api-key header", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/api/v1/campaigns", nil)
		r.Header.Set("X-API-Key", "mgk_live_abc123")
		if got := apiKeyFromRequest(r); got != "mgk_live_abc123" {
			t.Fatalf("expected key from X-API-Key, got %q", got)
		}
	})

	t.Run("bearer mgk token", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/api/v1/campaigns", nil)
		r.Header.Set("Authorization", "Bearer mgk_live_abc123")
		if got := apiKeyFromRequest(r); got != "mgk_live_abc123" {
			t.Fatalf("expected key from Authorization, got %q", got)
		}
	})

	t.Run("jwt bearer is ignored", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/api/v1/campaigns", nil)
		r.Header.Set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")
		if got := apiKeyFromRequest(r); got != "" {
			t.Fatalf("expected no API key for JWT, got %q", got)
		}
	})

	t.Run("missing auth", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/api/v1/campaigns", nil)
		if got := apiKeyFromRequest(r); got != "" {
			t.Fatalf("expected no API key, got %q", got)
		}
	})
}

func TestAPIKeyAllowed(t *testing.T) {
	s := &Server{}

	key := func(scopes ...string) *auth.Claims {
		return &auth.Claims{Role: "api", Scopes: scopes}
	}

	tests := []struct {
		name    string
		method  string
		path    string
		scopes  []string
		allowed bool
	}{
		{"empty scopes are full access", "POST", "/api/v1/campaigns", nil, true},
		{"matching write scope", "POST", "/api/v1/campaigns", []string{"campaigns:write"}, true},
		{"matching read scope on analytics", "GET", "/api/v1/analytics/overview", []string{"analytics:read"}, true},
		{"wrong write scope denied", "DELETE", "/api/v1/contacts/123", []string{"campaigns:write"}, false},
		{"read key denied on write route", "POST", "/api/v1/templates", []string{"analytics:read"}, false},
		{"workspace settings blocked", "GET", "/api/v1/workspace", []string{"campaigns:write"}, false},
		{"workspace brand-voice blocked", "PUT", "/api/v1/workspace/brand-voice", []string{"campaigns:write"}, false},
		{"ai blocked for keys", "POST", "/api/v1/ai/subject", []string{"campaigns:write"}, false},
		{"blocked account route", "GET", "/api/v1/me", []string{"campaigns:write"}, false},
		{"blocked billing route", "GET", "/api/v1/billing", nil, false},
		{"blocked api-keys route", "DELETE", "/api/v1/api-keys/123", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(tt.method, tt.path, nil)
			if got := s.apiKeyAllowed(r, key(tt.scopes...)); got != tt.allowed {
				t.Fatalf("apiKeyAllowed(%s %s, %v) = %v, want %v", tt.method, tt.path, tt.scopes, got, tt.allowed)
			}
		})
	}
}
