package httpapi

import (
	"net/http/httptest"
	"testing"
	"time"
)

func newTestProxies(t *testing.T, cidrs ...string) *TrustedProxies {
	t.Helper()
	tp, err := NewTrustedProxies(cidrs)
	if err != nil {
		t.Fatalf("NewTrustedProxies: %v", err)
	}
	return tp
}

func TestTrustedProxiesSpoofedHeadersIgnoredForUntrustedPeer(t *testing.T) {
	tp := newTestProxies(t, "127.0.0.1/32")
	// The caller connects directly (peer is a public address), so every
	// forwarded header must be ignored.
	r := httptest.NewRequest("GET", "/api/v1/contacts", nil)
	r.RemoteAddr = "203.0.113.7:5555"
	r.Header.Set("X-Mg-Client-IP", "198.51.100.9")
	r.Header.Set("X-Forwarded-For", "198.51.100.9")
	r.Header.Set("X-Real-IP", "198.51.100.9")

	if got := tp.clientIPFor(r); got != "203.0.113.7" {
		t.Fatalf("expected socket address, got %q", got)
	}
}

func TestTrustedProxiesTrustsMgClientIP(t *testing.T) {
	tp := newTestProxies(t, "127.0.0.1/32")
	r := httptest.NewRequest("GET", "/api/v1/contacts", nil)
	r.RemoteAddr = "127.0.0.1:5555"
	r.Header.Set("X-Mg-Client-IP", "198.51.100.9")
	// A spoofed XFF that would otherwise win must be ignored.
	r.Header.Set("X-Forwarded-For", "6.6.6.6")

	if got := tp.clientIPFor(r); got != "198.51.100.9" {
		t.Fatalf("expected x-mg-client-ip, got %q", got)
	}
}

func TestTrustedProxiesWalksForwardedChainFromRight(t *testing.T) {
	tp := newTestProxies(t, "127.0.0.1/32", "10.0.0.0/8")
	r := httptest.NewRequest("GET", "/api/v1/contacts", nil)
	r.RemoteAddr = "127.0.0.1:5555"
	// A spoofed leading value, then trusted LB hops, then the real client.
	r.Header.Set("X-Forwarded-For", "1.1.1.1, 10.0.0.5, 10.0.0.6")

	if got := tp.clientIPFor(r); got != "1.1.1.1" {
		t.Fatalf("expected rightmost untrusted hop, got %q", got)
	}
}

func TestTrustedProxiesFallsBackToRealIP(t *testing.T) {
	tp := newTestProxies(t, "127.0.0.1/32")
	r := httptest.NewRequest("GET", "/api/v1/contacts", nil)
	r.RemoteAddr = "127.0.0.1:5555"
	r.Header.Set("X-Real-IP", "198.51.100.9")

	if got := tp.clientIPFor(r); got != "198.51.100.9" {
		t.Fatalf("expected x-real-ip, got %q", got)
	}
}

func TestTrustedProxiesRejectsMalformedCIDR(t *testing.T) {
	if _, err := NewTrustedProxies([]string{"not-a-cidr"}); err == nil {
		t.Fatal("expected an error for a malformed CIDR")
	}
}

func TestIsBypassAddress(t *testing.T) {
	bypass := []string{"127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.0.1", "::1", "fe80::1", "not-an-ip"}
	for _, ip := range bypass {
		if !isBypassAddress(ip) {
			t.Errorf("expected %q to be a bypass address", ip)
		}
	}
	if isBypassAddress("8.8.8.8") {
		t.Error("public address must not be a bypass address")
	}
	if isBypassAddress("2606:4700:4700::1111") {
		t.Error("public IPv6 must not be a bypass address")
	}
}

func TestMetricPathNormalization(t *testing.T) {
	cases := map[string]string{
		"/api/v1/contacts": "/api/v1/contacts",
		"/api/v1/contacts/3f2a1c4e-1234-5678-9abc-def012345678": "/api/v1/contacts/{id}",
		"/api/v1/campaigns/42":      "/api/v1/campaigns/{id}",
		"/api/v1/campaigns/42/send": "/api/v1/campaigns/{id}/send",
		"/track/open":               "/track/open",
	}
	for in, want := range cases {
		if got := metricPath(in); got != want {
			t.Errorf("metricPath(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestVPNCacheExpiry(t *testing.T) {
	c := newVPNCache()
	if _, ok := c.get("8.8.8.8"); ok {
		t.Fatal("cache should start empty")
	}
	c.set("8.8.8.8", true)
	if v, ok := c.get("8.8.8.8"); !ok || !v {
		t.Fatal("expected cached VPN hit")
	}
	// Force expiry.
	c.mu.Lock()
	c.items["8.8.8.8"] = vpnEntry{isVPN: true, expires: time.Now().Add(-time.Second)}
	c.mu.Unlock()
	if _, ok := c.get("8.8.8.8"); ok {
		t.Fatal("expired entry should be a miss")
	}
}
