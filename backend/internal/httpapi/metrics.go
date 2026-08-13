package httpapi

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// durationBuckets are the histogram boundaries (in seconds) used for request
// latency, matching common Prometheus defaults.
var durationBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30}

type metricKey struct {
	method string
	path   string
	status string
}

// Metrics records lightweight, in-memory request telemetry and exposes it in
// the Prometheus text format at /metrics. Counters are atomic; the request
// histogram is guarded by a mutex because it is written on every request.
type Metrics struct {
	mu       sync.Mutex
	requests map[metricKey]uint64
	buckets  map[metricKey][]uint64
	sums     map[metricKey]float64

	active      atomic.Int64
	panics      atomic.Uint64
	rateLimited atomic.Uint64
	vpnBlocked  atomic.Uint64
}

func newMetrics() *Metrics {
	return &Metrics{
		requests: make(map[metricKey]uint64),
		buckets:  make(map[metricKey][]uint64),
		sums:     make(map[metricKey]float64),
	}
}

// Record tracks one completed HTTP request.
func (m *Metrics) Record(method, path string, status int, dur time.Duration) {
	if m == nil {
		return
	}
	m.active.Add(-1)
	path = metricPath(path)
	statusStr := strconv.Itoa(status)
	key := metricKey{method: method, path: path, status: statusStr}
	seconds := dur.Seconds()

	m.mu.Lock()
	m.requests[key]++
	if m.buckets[key] == nil {
		m.buckets[key] = make([]uint64, len(durationBuckets))
	}
	m.sums[key] += seconds
	for i, b := range durationBuckets {
		if seconds <= b {
			m.buckets[key][i]++
		}
	}
	m.mu.Unlock()
}

func (m *Metrics) Begin() {
	if m != nil {
		m.active.Add(1)
	}
}

func (m *Metrics) Panics() {
	if m != nil {
		m.panics.Add(1)
	}
}

func (m *Metrics) RateLimited() {
	if m != nil {
		m.rateLimited.Add(1)
	}
}

func (m *Metrics) VPNBlocked() {
	if m != nil {
		m.vpnBlocked.Add(1)
	}
}

// Handle serves the Prometheus text exposition format.
func (m *Metrics) Handle() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		if m == nil {
			_, _ = w.Write([]byte("# no metrics configured\n"))
			return
		}

		var out strings.Builder

		out.WriteString("# HELP mailgeko_http_requests_total Total HTTP requests by method, path and status.\n")
		out.WriteString("# TYPE mailgeko_http_requests_total counter\n")
		keys := sortedMetricKeys(m.requests)
		for _, k := range keys {
			fmt.Fprintf(&out, "mailgeko_http_requests_total{method=%q,path=%q,status=%q} %d\n", k.method, k.path, k.status, m.requests[k])
		}

		out.WriteString("# HELP mailgeko_http_request_duration_seconds HTTP request latency.\n")
		out.WriteString("# TYPE mailgeko_http_request_duration_seconds histogram\n")
		m.mu.Lock()
		histKeys := make([]metricKey, 0, len(m.buckets))
		for k := range m.buckets {
			histKeys = append(histKeys, k)
		}
		sort.Slice(histKeys, func(i, j int) bool {
			a, b := histKeys[i], histKeys[j]
			if a.path != b.path {
				return a.path < b.path
			}
			if a.method != b.method {
				return a.method < b.method
			}
			return a.status < b.status
		})
		for _, k := range histKeys {
			counts := m.buckets[k]
			var cumulative uint64
			for bi, bound := range durationBuckets {
				cumulative += counts[bi]
				fmt.Fprintf(&out, "mailgeko_http_request_duration_seconds_bucket{method=%q,path=%q,status=%q,le=%q} %d\n", k.method, k.path, k.status, formatFloat(bound), cumulative)
			}
			fmt.Fprintf(&out, "mailgeko_http_request_duration_seconds_bucket{method=%q,path=%q,status=%q,le=%q} %d\n", k.method, k.path, k.status, "+Inf", m.requests[k])
			fmt.Fprintf(&out, "mailgeko_http_request_duration_seconds_sum{method=%q,path=%q,status=%q} %s\n", k.method, k.path, k.status, formatFloat(m.sums[k]))
			fmt.Fprintf(&out, "mailgeko_http_request_duration_seconds_count{method=%q,path=%q,status=%q} %d\n", k.method, k.path, k.status, m.requests[k])
		}
		m.mu.Unlock()

		fmt.Fprintf(&out, "# HELP mailgeko_http_active_requests Currently in-flight HTTP requests.\n# TYPE mailgeko_http_active_requests gauge\nmailgeko_http_active_requests %d\n", m.active.Load())
		fmt.Fprintf(&out, "# HELP mailgeko_http_panics_total Recovered handler panics.\n# TYPE mailgeko_http_panics_total counter\nmailgeko_http_panics_total %d\n", m.panics.Load())
		fmt.Fprintf(&out, "# HELP mailgeko_http_rate_limited_total Requests rejected by the rate limiter.\n# TYPE mailgeko_http_rate_limited_total counter\nmailgeko_http_rate_limited_total %d\n", m.rateLimited.Load())
		fmt.Fprintf(&out, "# HELP mailgeko_vpn_blocked_total Requests rejected because the client IP is a known VPN/proxy.\n# TYPE mailgeko_vpn_blocked_total counter\nmailgeko_vpn_blocked_total %d\n", m.vpnBlocked.Load())

		_, _ = w.Write([]byte(out.String()))
	})
}

func sortedMetricKeys(m map[metricKey]uint64) []metricKey {
	keys := make([]metricKey, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		a, b := keys[i], keys[j]
		if a.path != b.path {
			return a.path < b.path
		}
		if a.method != b.method {
			return a.method < b.method
		}
		return a.status < b.status
	})
	return keys
}

// metricPath reduces a request path to a low-cardinality form so metric labels
// don't explode with per-resource paths (e.g. /api/v1/campaigns/{id}).
func metricPath(p string) string {
	segs := strings.Split(strings.Trim(p, "/"), "/")
	for i, s := range segs {
		if isIDLike(s) {
			segs[i] = "{id}"
		}
	}
	return "/" + strings.Join(segs, "/")
}

func isIDLike(s string) bool {
	if s == "" || len(s) > 64 {
		return false
	}
	if _, err := strconv.ParseInt(s, 10, 64); err == nil {
		return true
	}
	if !strings.Contains(s, "-") {
		return false
	}
	for _, r := range s {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'f' || r == '-') {
			return false
		}
	}
	return true
}

func formatFloat(f float64) string {
	return strconv.FormatFloat(f, 'g', -1, 64)
}

// statusRecorder captures the response status for logging and metrics. It must
// stay as thin a wrapper as possible to preserve http.ResponseWriter behaviour.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	if r.status == 0 {
		r.status = code
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.ResponseWriter.Write(b)
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}
