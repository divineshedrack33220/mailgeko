package httpapi

import (
	"context"
	"testing"
	"time"
)

func TestSessionStoreCRUD(t *testing.T) {
	rdb := newTestRedis(t)
	store := NewSessionStore(rdb)
	ctx := context.Background()

	if err := store.Create(ctx, "user-1", "tok-1", "Chrome on macOS", "10.0.0.1", "10.0.0.1", time.Hour); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := store.Create(ctx, "user-1", "tok-2", "Firefox on Linux", "10.0.0.2", "10.0.0.2", time.Hour); err != nil {
		t.Fatalf("Create: %v", err)
	}

	sessions, err := store.List(ctx, "user-1")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("List returned %d sessions, want 2", len(sessions))
	}

	if err := store.Revoke(ctx, "user-1", "tok-1", time.Hour); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	blacklisted, err := store.IsBlacklisted(ctx, "tok-1")
	if err != nil {
		t.Fatalf("IsBlacklisted: %v", err)
	}
	if !blacklisted {
		t.Error("expected revoked token to be blacklisted")
	}

	sessions, _ = store.List(ctx, "user-1")
	if len(sessions) != 1 || sessions[0].TokenID != "tok-2" {
		t.Errorf("after revoke, List = %+v, want only tok-2", sessions)
	}
}

func TestSessionStoreRevokeAllExcept(t *testing.T) {
	rdb := newTestRedis(t)
	store := NewSessionStore(rdb)
	ctx := context.Background()

	for _, id := range []string{"a", "b", "c"} {
		if err := store.Create(ctx, "user-1", id, "Browser", "ip", "ip", time.Hour); err != nil {
			t.Fatalf("Create %s: %v", id, err)
		}
	}

	if err := store.RevokeAllExcept(ctx, "user-1", "b", time.Hour); err != nil {
		t.Fatalf("RevokeAllExcept: %v", err)
	}

	sessions, _ := store.List(ctx, "user-1")
	if len(sessions) != 1 || sessions[0].TokenID != "b" {
		t.Errorf("after revoke all, List = %+v, want only b", sessions)
	}
	for _, id := range []string{"a", "c"} {
		blacklisted, _ := store.IsBlacklisted(ctx, id)
		if !blacklisted {
			t.Errorf("expected %s to be blacklisted", id)
		}
	}
	kept, _ := store.IsBlacklisted(ctx, "b")
	if kept {
		t.Error("current session should not be blacklisted")
	}
}

func TestDeviceFromUserAgent(t *testing.T) {
	cases := []struct {
		ua   string
		want string
	}{
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36", "Chrome on macOS"},
		{"Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/126.0", "Firefox on Linux"},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0", "Edge on Windows"},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", "Safari on iOS"},
		{"curl/8.1.2", "Browser on Unknown OS"},
	}
	for _, c := range cases {
		if got := deviceFromUserAgent(c.ua); got != c.want {
			t.Errorf("deviceFromUserAgent(%q) = %q, want %q", c.ua, got, c.want)
		}
	}
}

func TestSessionStoreTouch(t *testing.T) {
	rdb := newTestRedis(t)
	store := NewSessionStore(rdb)
	ctx := context.Background()

	if err := store.Create(ctx, "user-1", "tok-1", "Browser", "ip", "ip", time.Hour); err != nil {
		t.Fatalf("Create: %v", err)
	}
	store.Touch(ctx, "user-1", "tok-1", time.Hour)

	sessions, _ := store.List(ctx, "user-1")
	if len(sessions) != 1 {
		t.Fatalf("List returned %d, want 1", len(sessions))
	}
	if sessions[0].LastSeen.Before(sessions[0].IssuedAt) {
		t.Error("expected lastSeen to be after issuedAt after Touch")
	}
}
