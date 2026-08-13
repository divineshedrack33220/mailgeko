package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakePinger struct {
	err error
}

func (f fakePinger) Ping(ctx context.Context) error { return f.err }

func testServerWithChecks(checks ...readyCheck) *Server {
	return &Server{
		logger:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		readyChecks: checks,
	}
}

func TestReadyzAllUp(t *testing.T) {
	s := testServerWithChecks(
		readyCheck{name: "tidb", ping: fakePinger{}},
		readyCheck{name: "queue", ping: fakePinger{}},
	)

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest("GET", "/readyz", nil))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"tidb":"up"`) || !strings.Contains(rr.Body.String(), `"queue":"up"`) {
		t.Fatalf("expected both checks up, got: %s", rr.Body.String())
	}
}

func TestReadyzDependencyDown(t *testing.T) {
	s := testServerWithChecks(
		readyCheck{name: "tidb", ping: fakePinger{}},
		readyCheck{name: "queue", ping: fakePinger{err: errors.New("redis unreachable")}},
	)

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest("GET", "/readyz", nil))

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"queue":"down"`) {
		t.Fatalf("expected queue down, got: %s", rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"tidb":"up"`) {
		t.Fatalf("expected tidb still up, got: %s", rr.Body.String())
	}
}

func TestReadyzEmptyChecks(t *testing.T) {
	s := testServerWithChecks()

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest("GET", "/readyz", nil))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 with no dependencies, got %d", rr.Code)
	}
}
