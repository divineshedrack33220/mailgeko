package httpapi

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	mr := miniredis.RunT(t)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

func TestSessionStoreBlacklist(t *testing.T) {
	rdb := newTestRedis(t)
	store := NewSessionStore(rdb)
	ctx := context.Background()

	blacklisted, err := store.IsBlacklisted(ctx, "token-1")
	if err != nil {
		t.Fatalf("IsBlacklisted: %v", err)
	}
	if blacklisted {
		t.Fatal("token should not be blacklisted initially")
	}

	if err := store.Blacklist(ctx, "token-1", time.Hour); err != nil {
		t.Fatalf("Blacklist: %v", err)
	}
	blacklisted, err = store.IsBlacklisted(ctx, "token-1")
	if err != nil {
		t.Fatalf("IsBlacklisted: %v", err)
	}
	if !blacklisted {
		t.Fatal("token should be blacklisted after Blacklist")
	}
}

func TestRateLimiter(t *testing.T) {
	rdb := newTestRedis(t)
	rl := NewRateLimiter(rdb, 3, time.Minute)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		ok, _ := rl.Allow(ctx, "ip-1")
		if !ok {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	ok, _ := rl.Allow(ctx, "ip-1")
	if ok {
		t.Fatal("request 4 should be limited")
	}

	// A different key should be unaffected.
	ok, _ = rl.Allow(ctx, "ip-2")
	if !ok {
		t.Fatal("different key should be allowed")
	}
}
