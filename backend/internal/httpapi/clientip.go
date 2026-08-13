package httpapi

import (
	"fmt"
	"net"
	"net/http"
	"strings"
)

// TrustedProxies is a set of CIDRs whose forwarded-identity headers
// (X-Forwarded-For, X-Real-IP and the Mailgeko-proxy X-Mg-Client-IP header)
// are trusted. Requests whose direct socket peer is NOT in this set are keyed
// on the socket address alone, so header spoofing is impossible from untrusted
// peers.
type TrustedProxies struct {
	nets []*net.IPNet
}

// NewTrustedProxies parses a list of CIDR strings (e.g. "127.0.0.1/32,::1/128").
// The default for a single-container deployment is loopback only, which covers
// the Next.js -> Go API rewrites running on the same host.
func NewTrustedProxies(cidrs []string) (*TrustedProxies, error) {
	tp := &TrustedProxies{}
	for _, c := range cidrs {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			return nil, fmt.Errorf("invalid trusted proxy CIDR %q: %w", c, err)
		}
		tp.nets = append(tp.nets, n)
	}
	return tp, nil
}

// Contains reports whether ip is within a trusted CIDR.
func (tp *TrustedProxies) Contains(ip net.IP) bool {
	if tp == nil {
		return false
	}
	for _, n := range tp.nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// peerIP returns the direct socket peer of a request, or nil when it cannot be
// parsed.
func peerIP(r *http.Request) net.IP {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return net.ParseIP(strings.TrimSpace(host))
}

// forwardedClient walks a comma-separated forwarded chain from the RIGHT (the
// entry appended by the nearest proxy is the authoritative client) and returns
// the first hop that is not a trusted proxy. When every hop is trusted it
// returns the leftmost non-empty value as a best effort.
func (tp *TrustedProxies) forwardedClient(fwd string) string {
	parts := strings.Split(fwd, ",")
	for i := len(parts) - 1; i >= 0; i-- {
		candidate := strings.TrimSpace(parts[i])
		if candidate == "" {
			continue
		}
		if ip := net.ParseIP(candidate); ip != nil && tp.Contains(ip) {
			continue
		}
		return candidate
	}
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			return v
		}
	}
	return ""
}

// clientIPFor returns the best-effort real client IP for a request.
//
// Security model: forwarded-identity headers are only honoured when the direct
// peer is a trusted proxy. The x-mg-client-ip header is set by the Next.js
// middleware (which runs before the /api rewrites and overwrites any value a
// client supplies), so it is authoritative when present from a trusted peer.
func (tp *TrustedProxies) clientIPFor(r *http.Request) string {
	peer := peerIP(r)
	if peer == nil || !tp.Contains(peer) {
		// Direct connection or untrusted peer: headers are spoofable, so only
		// the socket address is meaningful.
		if peer != nil {
			return peer.String()
		}
		return r.RemoteAddr
	}

	if ip := strings.TrimSpace(r.Header.Get("X-Mg-Client-IP")); ip != "" {
		return ip
	}
	if ip := tp.forwardedClient(r.Header.Get("X-Forwarded-For")); ip != "" {
		return ip
	}
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	return peer.String()
}
