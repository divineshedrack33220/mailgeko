package config

import (
	"reflect"
	"strings"
	"testing"
)

func TestOriginOf(t *testing.T) {
	tests := []struct {
		raw     string
		want    string
		wantErr bool
	}{
		{raw: "https://mailgeko.onrender.com", want: "https://mailgeko.onrender.com"},
		{raw: "https://app.mailgeko.com/sub", want: "https://app.mailgeko.com"},
		{raw: "http://localhost:3000", want: "http://localhost:3000"},
		{raw: "not-a-url", wantErr: true},
		{raw: "", wantErr: true},
	}
	for _, tt := range tests {
		got, err := originOf(tt.raw)
		if tt.wantErr {
			if err == nil {
				t.Errorf("originOf(%q): expected error, got %q", tt.raw, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("originOf(%q): unexpected error: %v", tt.raw, err)
			continue
		}
		if got != tt.want {
			t.Errorf("originOf(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}

func TestLoadAllowedOriginsExplicitWins(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://a.example.com, https://b.example.com")
	got := loadAllowedOrigins("https://other.example.com", "production")
	want := []string{"https://a.example.com", "https://b.example.com"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("explicit allowlist = %v, want %v", got, want)
	}
}

func TestLoadAllowedOriginsFallsBackToBaseURL(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "")
	got := loadAllowedOrigins("https://mailgeko.onrender.com", "production")
	want := []string{"https://mailgeko.onrender.com"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("production fallback = %v, want %v", got, want)
	}
}

func TestValidateBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		env     string
		wantErr bool
	}{
		{name: "production public origin", baseURL: "https://clawmark.online", env: "production"},
		{name: "production public with path", baseURL: "https://app.mailgeko.com/", env: "production"},
		{name: "production rejects missing fallback", baseURL: "http://localhost:8080", env: "production", wantErr: true},
		{name: "production rejects loopback ip", baseURL: "http://127.0.0.1:8080", env: "production", wantErr: true},
		{name: "production rejects unset", baseURL: "http://localhost:8080", env: "production", wantErr: true},
		{name: "production rejects garbage", baseURL: "not-a-url", env: "production", wantErr: true},
		{name: "production rejects empty", baseURL: "", env: "production", wantErr: true},
		{name: "dev allows localhost fallback", baseURL: "http://localhost:8080", env: "development"},
		{name: "dev allows empty scheme", baseURL: "http://localhost:8080", env: "test"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateBaseURL(tt.baseURL, tt.env)
			if tt.wantErr && err == nil {
				t.Errorf("validateBaseURL(%q, %q): expected error, got nil", tt.baseURL, tt.env)
			}
			if !tt.wantErr && err != nil {
				t.Errorf("validateBaseURL(%q, %q): unexpected error: %v", tt.baseURL, tt.env, err)
			}
		})
	}
}

func TestLoadRejectsLocalhostBaseURLInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("BASE_URL", "")
	t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	t.Setenv("TIDB_DSN", "u:p@tcp(host:4000)/mailgeko?tls=true&parseTime=true&charset=utf8mb4")
	t.Setenv("RESEND_API_KEYS", "re_test")
	_, err := Load()
	if err == nil {
		t.Fatal("Load(): expected error for localhost BASE_URL in production, got nil")
	}
}

func TestLoadAllowedOriginsAddsLocalhostInDev(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "")
	got := loadAllowedOrigins("http://localhost:8080", "development")
	want := []string{
		"http://localhost:8080",
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:8080",
		"http://127.0.0.1:8080",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("dev fallback = %v, want %v", got, want)
	}
}
