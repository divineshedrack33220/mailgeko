package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type fakeSearcher struct {
	enabled bool
	results []engine.SearchResult
	err     error
}

func (f *fakeSearcher) EmbeddingEnabled() bool { return f.enabled }
func (f *fakeSearcher) SearchContacts(ctx context.Context, ws, query string, limit int) ([]engine.SearchResult, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.results, nil
}
func (f *fakeSearcher) SimilarContacts(ctx context.Context, ws, contactID string, limit int) ([]engine.SearchResult, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.results, nil
}

func newSearchTestServer(t *testing.T, s ContactSearcher, db *store.Store) *httptest.Server {
	t.Helper()
	mgr := auth.NewTokenManager("test-secret", time.Hour)
	srv := New(Config{}, db, nil, mgr, nil, nil, nil, s, nil, nil)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		srv.Handler().ServeHTTP(w, r)
	}))
	t.Cleanup(ts.Close)
	return ts
}

func searchAuthToken(t *testing.T) string {
	t.Helper()
	mgr := auth.NewTokenManager("test-secret", time.Hour)
	tok, err := mgr.Issue("user-1", "u@example.com", "ws-1", "owner")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestSearchContacts(t *testing.T) {
	s := &fakeSearcher{
		enabled: true,
		results: []engine.SearchResult{{
			Contact: &store.Contact{ID: "c-1", Email: "a@example.com", FirstName: "Ada"},
			Score:   0.93,
		}},
	}
	ts := newSearchTestServer(t, s, nil)
	token := searchAuthToken(t)

	req, _ := http.NewRequest("GET", ts.URL+"/api/v1/contacts/search?q=marketing+leads&k=5", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	hits := body["hits"].([]any)
	if len(hits) != 1 {
		t.Fatalf("expected 1 hit, got %d", len(hits))
	}
	hit := hits[0].(map[string]any)
	if hit["score"].(float64) != 0.93 {
		t.Fatalf("unexpected score: %v", hit["score"])
	}
	contact := hit["contact"].(map[string]any)
	if contact["email"] != "a@example.com" {
		t.Fatalf("unexpected contact: %v", contact)
	}
}

func TestSearchDisabled(t *testing.T) {
	ts := newSearchTestServer(t, &fakeSearcher{enabled: false}, nil)
	token := searchAuthToken(t)
	req, _ := http.NewRequest("GET", ts.URL+"/api/v1/contacts/search?q=x", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.StatusCode)
	}
}
