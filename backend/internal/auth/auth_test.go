package auth

import (
	"encoding/base64"
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

func TestVerifyPasswordRejectsUnsafeParams(t *testing.T) {
	salt := base64.RawStdEncoding.EncodeToString(make([]byte, 16))
	hash := base64.RawStdEncoding.EncodeToString(make([]byte, 32))
	unsafe := []string{
		"$argon2id$v=19$m=4294967296,t=3,p=2$" + salt + "$" + hash, // 4 GiB memory: uint32 overflow
		"$argon2id$v=19$m=65536,t=0,p=2$" + salt + "$" + hash,      // zero iterations
		"$argon2id$v=19$m=65536,t=101,p=2$" + salt + "$" + hash,    // iterations over cap
		"$argon2id$v=19$m=65536,t=3,p=256$" + salt + "$" + hash,    // parallelism over uint8 range
		"$argon2id$v=19$m=1024,t=3,p=2$" + salt + "$" + hash,       // memory below floor
		"$argon2id$v=19$m=65536,t=3,p=2$" + salt + "$" + base64.RawStdEncoding.EncodeToString(make([]byte, 4)),
	}
	for _, encoded := range unsafe {
		if _, err := VerifyPassword("password", encoded); err == nil {
			t.Fatalf("expected unsafe params to be rejected: %s", encoded)
		}
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

func TestPendingTwoFactorToken(t *testing.T) {
	m := NewTokenManager("test-secret", time.Hour)
	token, err := m.IssuePendingTwoFactor("user-1", "a@b.com")
	if err != nil {
		t.Fatalf("IssuePendingTwoFactor: %v", err)
	}
	claims, err := m.Parse(token)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if !claims.Pending {
		t.Error("expected pending flag on 2FA token")
	}
	if claims.GetWorkspaceID() != "" || claims.GetRole() != "" {
		t.Error("pending token should carry no workspace or role")
	}
	if claims.ExpiresAt.Time.After(time.Now().Add(15 * time.Minute)) {
		t.Error("pending token should be short-lived")
	}

	normal, err := m.Issue("user-1", "a@b.com", "ws-1", "owner")
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	normalClaims, err := m.Parse(normal)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if normalClaims.Pending {
		t.Error("normal token should not be pending")
	}
}
