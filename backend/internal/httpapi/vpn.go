package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

// vpnCache caches IP lookups to avoid hammering the external provider. The
// cache is bounded by pruning expired entries when it grows large.
type vpnCache struct {
	mu    sync.RWMutex
	items map[string]vpnEntry
}

type vpnEntry struct {
	isVPN   bool
	expires time.Time
}

func newVPNCache() *vpnCache {
	return &vpnCache{items: make(map[string]vpnEntry)}
}

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
	if len(c.items) > 4096 {
		now := time.Now()
		for k, e := range c.items {
			if now.After(e.expires) {
				delete(c.items, k)
			}
		}
	}
	c.items[ip] = vpnEntry{isVPN: isVPN, expires: time.Now().Add(1 * time.Hour)}
}

// ipAPIResponse is the shape returned by ip-api.com.
type ipAPIResponse struct {
	Status  string `json:"status"`
	Proxy   bool   `json:"proxy"`
	Hosting bool   `json:"hosting"`
}

// vpnLookup resolves whether an IP is a known VPN/proxy endpoint using
// ip-api.com. It never blocks the auth hot path: cache misses trigger a
// background, deduplicated lookup and fail open.
type vpnLookup struct {
	client   *http.Client
	cache    *vpnCache
	inflight sync.Map // ip -> struct{}
	baseURL  string
}

func newVPNLookup(client *http.Client) *vpnLookup {
	return &vpnLookup{client: client, cache: newVPNCache(), baseURL: "https://ip-api.com"}
}

// isVPNBlocked reports whether the given IP is a known VPN/proxy endpoint.
// It performs no synchronous network I/O: on a cache miss it starts a single
// background lookup per IP and returns false. Lookup and provider failures also
// fail open so availability never depends on ip-api.com.
func (v *vpnLookup) isVPNBlocked(ip string) bool {
	if v == nil {
		return false
	}
	if isBypassAddress(ip) {
		return false
	}
	if cached, ok := v.cache.get(ip); ok {
		return cached
	}
	if _, loaded := v.inflight.LoadOrStore(ip, struct{}{}); loaded {
		return false
	}
	go func() {
		defer v.inflight.Delete(ip)
		v.cache.set(ip, v.lookup(ip))
	}()
	return false
}

// lookup performs the blocking external call. Only called from the background
// goroutine spawned in isVPNBlocked.
func (v *vpnLookup) lookup(ip string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/json/%s?fields=status,proxy,hosting", v.baseURL, ip)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	var data ipAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return false
	}
	return data.Status == "success" && (data.Proxy || data.Hosting)
}

// isBypassAddress reports whether the IP can never be a VPN exit node (loopback,
// private, link-local, multicast or unspecified). The check is lenient: invalid
// strings are treated as bypass so the VPN feature cannot break misconfigured
// deployments.
func isBypassAddress(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return true
	}
	return parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsUnspecified() ||
		parsed.IsLinkLocalUnicast() || parsed.IsMulticast() || parsed.IsLinkLocalMulticast()
}
