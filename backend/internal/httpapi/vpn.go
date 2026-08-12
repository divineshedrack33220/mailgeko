package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// vpnCache caches IP lookups to avoid hammering the API.
type vpnCache struct {
	mu    sync.RWMutex
	items map[string]vpnEntry
}

type vpnEntry struct {
	isVPN   bool
	expires time.Time
}

var cache = &vpnCache{items: make(map[string]vpnEntry)}

func (c *vpnCache) get(ip string) (isVPN, ok bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, found := c.items[ip]
	if !found || time.Now().After(e.expires) {
		return false, false
	}
	return e.isVPN, true
}

func (c *vpnCache) set(ip string, isVPN bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[ip] = vpnEntry{isVPN: isVPN, expires: time.Now().Add(1 * time.Hour)}
}

// ipAPIResponse is the shape returned by ip-api.com.
type ipAPIResponse struct {
	Status    string `json:"status"`
	Proxy     bool   `json:"proxy"`
	Hosting   bool   `json:"hosting"`
	Query     string `json:"query"`
}

// isVPN checks whether the given IP is a known VPN/proxy endpoint.
// Returns (isVPN, error). Uses ip-api.com with a local cache.
func isVPN(ctx context.Context, client *http.Client, ip string) (bool, error) {
	// Skip private / loopback — those are never VPN exit nodes.
	if parsed := net.ParseIP(ip); parsed != nil {
		if parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsUnspecified() {
			return false, nil
		}
	}

	if cached, ok := cache.get(ip); ok {
		return cached, nil
	}

	url := fmt.Sprintf("http://ip-api.com/json/%s?fields=proxy,hosting", ip)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var data ipAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return false, err
	}

	isVPN := data.Proxy || data.Hosting
	cache.set(ip, isVPN)
	return isVPN, nil
}

// extractIP gets the real client IP from headers or RemoteAddr.
func extractIP(r *http.Request) string {
	// Check common proxy headers first.
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	// Fall back to RemoteAddr.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
