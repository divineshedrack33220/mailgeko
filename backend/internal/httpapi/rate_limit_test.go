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

func TestRateLimiterAllowFixed(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	rl := NewRateLimiter(rdb, 3, time.Minute)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		if !rl.AllowFixed(ctx, "u:user-1:/api/v1/contacts") {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	if rl.AllowFixed(ctx, "u:user-1:/api/v1/contacts") {
		t.Fatal("request 4 should be limited")
	}

	// Different user + path combos are independent.
	if !rl.AllowFixed(ctx, "u:user-2:/api/v1/contacts") {
		t.Fatal("different user should be allowed")
	}
	if !rl.AllowFixed(ctx, "u:user-1:/api/v1/campaigns") {
		t.Fatal("different path should be allowed")
	}

	// Window expiry resets the counter.
	mr.FastForward(2 * time.Minute)
	if !rl.AllowFixed(ctx, "u:user-1:/api/v1/contacts") {
		t.Fatal("counter should reset after the window expires")
	}
}

func TestRateLimiterAllowFixedNil(t *testing.T) {
	var rl *RateLimiter
	if !rl.AllowFixed(context.Background(), "any") {
		t.Fatal("nil limiter must allow everything")
	}
}

func TestRateLimiterFailOpenOnRedisError(t *testing.T) {
	// Point at a closed, dead address so every Redis call errors quickly.
	rdb := redis.NewClient(&redis.Options{
		Addr:        "127.0.0.1:1",
		DialTimeout: 50 * time.Millisecond,
		MaxRetries:  1,
	})
	defer rdb.Close()
	rl := NewRateLimiter(rdb, 3, time.Minute)
	ctx := context.Background()

	if !rl.AllowFixed(ctx, "u:user-1:/x") {
		t.Fatal("Redis errors must fail open")
	}
	if ok, _ := rl.Allow(ctx, "ip-1"); !ok {
		t.Fatal("sliding window must fail open on Redis errors")
	}
}
