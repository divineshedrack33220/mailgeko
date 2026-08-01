package auth

import (
	"strings"
	"testing"
	"time"
)

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := HashPassword("supersecret123")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=19$") {
		t.Fatalf("unexpected hash prefix: %s", hash)
	}

	ok, err := VerifyPassword("supersecret123", hash)
	if err != nil {
		t.Fatalf("VerifyPassword: %v", err)
	}
	if !ok {
		t.Fatal("expected password to verify")
	}

	ok, err = VerifyPassword("wrongpassword", hash)
	if err != nil {
		t.Fatalf("VerifyPassword: %v", err)
	}
	if ok {
		t.Fatal("expected wrong password to fail")
	}
}

func TestHashProducesUniqueSalts(t *testing.T) {
	h1, _ := HashPassword("same-password")
	h2, _ := HashPassword("same-password")
	if h1 == h2 {
		t.Fatal("expected different hashes for same password")
	}
}

func TestVerifyPasswordInvalidHash(t *testing.T) {
	if _, err := VerifyPassword("password", "not-a-hash"); err == nil {
		t.Fatal("expected error for malformed hash")
	}
	if _, err := VerifyPassword("password", ""); err == nil {
		t.Fatal("expected error for empty hash")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	m := NewTokenManager("test-secret", time.Hour)
	token, err := m.Issue("user-1", "a@b.com", "ws-1", "owner")
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}

	claims, err := m.Parse(token)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if claims.GetUserID() != "user-1" {
		t.Errorf("userID = %q, want user-1", claims.GetUserID())
	}
	if claims.GetEmail() != "a@b.com" {
		t.Errorf("email = %q, want a@b.com", claims.GetEmail())
	}
	if claims.GetWorkspaceID() != "ws-1" {
		t.Errorf("workspaceID = %q, want ws-1", claims.GetWorkspaceID())
	}
	if claims.GetRole() != "owner" {
		t.Errorf("role = %q, want owner", claims.GetRole())
	}
	if claims.GetTokenID() == "" {
		t.Error("expected token id to be set")
	}
}

func TestParseRejectsInvalidToken(t *testing.T) {
	m := NewTokenManager("test-secret", 0)
	if _, err := m.Parse("not-a-token"); err == nil {
		t.Fatal("expected error for malformed token")
	}

	m2 := NewTokenManager("different-secret", 0)
	token, _ := m.Issue("u", "e", "w", "r")
	if _, err := m2.Parse(token); err == nil {
		t.Fatal("expected error for token signed with wrong secret")
	}
}
