package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newTestMiddlewareServer(t *testing.T, origins ...string) *Server {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return &Server{
		cfg:            Config{AllowedOrigins: origins},
		rateLimit:      NewRateLimiter(rdb, 3, time.Minute),
		logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		metrics:        newMetrics(),
		trustedProxies: mustTestProxies(t, "127.0.0.1/32"),
		vpn:            newVPNLookup(nil),
	}
}

func mustTestProxies(t *testing.T, cidrs ...string) *TrustedProxies {
	t.Helper()
	tp, err := NewTrustedProxies(cidrs)
	if err != nil {
		t.Fatalf("NewTrustedProxies: %v", err)
	}
	return tp
}

func okHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func TestMiddlewareSecurityHeadersOnEveryResponse(t *testing.T) {
	s := newTestMiddlewareServer(t)
	rr := httptest.NewRecorder()
	s.withMiddleware(http.HandlerFunc(okHandler)).ServeHTTP(rr, httptest.NewRequest("GET", "/x", nil))

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	for _, h := range []string{"X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"} {
		if rr.Header().Get(h) == "" {
			t.Errorf("missing security header %q", h)
		}
	}
}

func TestMiddlewareCORSHonoursAllowlist(t *testing.T) {
	s := newTestMiddlewareServer(t, "https://app.example.com")

	// Allowed origin gets the header.
	req := httptest.NewRequest("GET", "/x", nil)
	req.Header.Set("Origin", "https://app.example.com")
	rr := httptest.NewRecorder()
	s.withMiddleware(http.HandlerFunc(okHandler)).ServeHTTP(rr, req)
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://app.example.com" {
		t.Fatalf("allowed origin missing CORS header, got %q", rr.Header().Get("Access-Control-Allow-Origin"))
	}

	// Disallowed origin does not.
	req2 := httptest.NewRequest("GET", "/x", nil)
	req2.Header.Set("Origin", "https://evil.example.com")
	rr2 := httptest.NewRecorder()
	s.withMiddleware(http.HandlerFunc(okHandler)).ServeHTTP(rr2, req2)
	if rr2.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("disallowed origin received CORS header %q", rr2.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestMiddlewareCORSPreflightShortCircuits(t *testing.T) {
	s := newTestMiddlewareServer(t, "https://app.example.com")
	req := httptest.NewRequest(http.MethodOptions, "/x", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rr := httptest.NewRecorder()

	called := false
	s.withMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})).ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for preflight, got %d", rr.Code)
	}
	if called {
		t.Fatal("preflight must not reach the handler")
	}
}

func TestMiddlewareRecoveryReturns500(t *testing.T) {
	s := newTestMiddlewareServer(t)
	rr := httptest.NewRecorder()
	s.withMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})).ServeHTTP(rr, httptest.NewRequest("GET", "/x", nil))

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 after panic, got %d", rr.Code)
	}
}

func TestMiddlewareRateLimitBlocksOverLimit(t *testing.T) {
	s := newTestMiddlewareServer(t)

	for i := 0; i < 3; i++ {
		rr := httptest.NewRecorder()
		s.withMiddleware(http.HandlerFunc(okHandler)).ServeHTTP(rr, httptest.NewRequest("GET", "/x", nil))
		if rr.Code != http.StatusNoContent {
			t.Fatalf("request %d expected 204, got %d", i+1, rr.Code)
		}
	}

	rr := httptest.NewRecorder()
	s.withMiddleware(http.HandlerFunc(okHandler)).ServeHTTP(rr, httptest.NewRequest("GET", "/x", nil))
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "rate_limited") {
		t.Fatalf("expected rate_limited code in body, got %q", rr.Body.String())
	}
}

func TestMiddlewareRateLimitSkipsWhenUnconfigured(t *testing.T) {
	s := &Server{
		logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		metrics:        newMetrics(),
		trustedProxies: mustTestProxies(t),
	}
	// rateLimit nil → no limiter applied.
	rr := httptest.NewRecorder()
	s.withMiddleware(http.HandlerFunc(okHandler)).ServeHTTP(rr, httptest.NewRequest("GET", "/x", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 without a limiter, got %d", rr.Code)
	}
}
