package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// lookupFor spins up an httptest server serving ip-api.com-shaped responses and
// returns a lookup pointed at it.
func lookupFor(t *testing.T, handler http.HandlerFunc) *vpnLookup {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	v := newVPNLookup(srv.Client())
	v.baseURL = srv.URL
	return v
}

func ipAPIResponseBody(isVPN bool) string {
	b, _ := json.Marshal(ipAPIResponse{Status: "success", Proxy: isVPN, Hosting: false})
	return string(b)
}

func TestVPNLookupRecognizesProxy(t *testing.T) {
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/json/198.51.100.7" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(ipAPIResponseBody(true)))
	})

	if !v.lookup("198.51.100.7") {
		t.Fatal("expected proxy IP to be blocked")
	}
}

func TestVPNLookupAllowsCleanIP(t *testing.T) {
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(ipAPIResponseBody(false)))
	})

	if v.lookup("198.51.100.7") {
		t.Fatal("expected clean IP to be allowed")
	}
}

func TestVPNLookupFailsOpenOnProviderError(t *testing.T) {
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream down", http.StatusBadGateway)
	})

	if v.lookup("198.51.100.7") {
		t.Fatal("provider failure must fail open")
	}
}

func TestVPNLookupFailsOpenOnMalformedBody(t *testing.T) {
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("not json"))
	})

	if v.lookup("198.51.100.7") {
		t.Fatal("malformed body must fail open")
	}
}

func TestVPNLookupFailsOpenOnTimeout(t *testing.T) {
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})
	v.client.Timeout = 5 * time.Millisecond

	if v.lookup("198.51.100.7") {
		t.Fatal("timeout must fail open")
	}
}

func TestIsVPNBlockedNeverBlocksOnCacheMiss(t *testing.T) {
	// The server hangs; a synchronous lookup would deadlock the test. A cache
	// miss must return immediately and resolve in the background.
	started := make(chan struct{})
	release := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)

	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
		w.WriteHeader(http.StatusOK)
	})

	done := make(chan bool, 1)
	go func() {
		defer wg.Done()
		done <- v.isVPNBlocked("198.51.100.7")
	}()

	select {
	case <-time.After(100 * time.Millisecond):
		t.Fatal("isVPNBlocked must not block on a cache miss")
	case blocked := <-done:
		if blocked {
			t.Fatal("cache miss must fail open")
		}
	}

	// Let the background lookup finish, then the cached result is authoritative.
	<-started
	close(release)
	wg.Wait()

	deadline := time.Now().Add(2 * time.Second)
	for {
		if cached, ok := v.cache.get("198.51.100.7"); ok {
			if cached {
				t.Fatal("expected background lookup to record a clean IP")
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("background lookup did not populate the cache")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestIsVPNBlockedReturnsCachedTrue(t *testing.T) {
	calls := 0
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(ipAPIResponseBody(true)))
	})

	v.cache.set("198.51.100.7", true)
	if !v.isVPNBlocked("198.51.100.7") {
		t.Fatal("cached VPN IP must be blocked without a network call")
	}
	if calls != 0 {
		t.Fatalf("expected no provider calls, got %d", calls)
	}
}

func TestIsVPNBlockedDedupesInflightLookups(t *testing.T) {
	release := make(chan struct{})
	var calls atomic.Int32
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		<-release
		w.WriteHeader(http.StatusOK)
	})

	// First call starts a background lookup and returns false.
	v.isVPNBlocked("198.51.100.7")
	// Second call while inflight must not start another lookup.
	v.isVPNBlocked("198.51.100.7")

	close(release)
	deadline := time.Now().Add(2 * time.Second)
	for {
		if _, ok := v.cache.get("198.51.100.7"); ok {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("background lookup did not populate the cache")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected a single provider call, got %d", calls.Load())
	}
}

func TestIsVPNBlockedNilReceiver(t *testing.T) {
	var v *vpnLookup
	if v.isVPNBlocked("8.8.8.8") {
		t.Fatal("nil lookup must fail open")
	}
}

func TestIsVPNBlockedSkipsBypassAddresses(t *testing.T) {
	calls := 0
	v := lookupFor(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusOK)
	})

	if v.isVPNBlocked("127.0.0.1") || v.isVPNBlocked("192.168.1.1") {
		t.Fatal("bypass addresses must never be blocked")
	}
	if calls != 0 {
		t.Fatalf("bypass addresses must not hit the provider, got %d calls", calls)
	}
}
