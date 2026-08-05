package config

import (
	"reflect"
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
