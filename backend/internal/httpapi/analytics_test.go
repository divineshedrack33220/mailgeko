package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/analytics"
	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
)

type fakeAnalytics struct {
	series    []analytics.SeriesPoint
	links     []analytics.LinkStat
	devices   []analytics.DeviceStat
	countries []analytics.CountryStat
	grid      [][]int64
}

func (f *fakeAnalytics) TopLinks(ctx context.Context, ws string, days, limit int) ([]analytics.LinkStat, error) {
	return f.links, nil
}
func (f *fakeAnalytics) DeviceStats(ctx context.Context, ws string, days int) ([]analytics.DeviceStat, error) {
	return f.devices, nil
}
func (f *fakeAnalytics) CountryStats(ctx context.Context, ws string, days int) ([]analytics.CountryStat, error) {
	return f.countries, nil
}
func (f *fakeAnalytics) Series(ctx context.Context, ws string, days int, monthly bool) ([]analytics.SeriesPoint, error) {
	return f.series, nil
}
func (f *fakeAnalytics) Heatmap(ctx context.Context, ws string, days int) ([][]int64, error) {
	return f.grid, nil
}

func newAnalyticsTestServer(t *testing.T, a AnalyticsStore) *httptest.Server {
	t.Helper()
	mgr := auth.NewTokenManager("test-secret", time.Hour)
	srv := New(Config{}, nil, a, mgr, nil, nil, nil, nil, nil, nil)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		srv.Handler().ServeHTTP(w, r)
	}))
	t.Cleanup(ts.Close)
	ts.Client().CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return ts
}

func authGet(t *testing.T, ts *httptest.Server, token, path string) map[string]any {
	t.Helper()
	req, _ := http.NewRequest("GET", ts.URL+path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET %s: status %d", path, resp.StatusCode)
	}
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
	return body
}

func newAuthToken(t *testing.T) string {
	t.Helper()
	mgr := auth.NewTokenManager("test-secret", time.Hour)
	tok, err := mgr.Issue("user-1", "u@example.com", "ws-1", "owner")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestAnalyticsSeriesHandler(t *testing.T) {
	a := &fakeAnalytics{series: []analytics.SeriesPoint{
		{Date: "2026-07-01", Opens: 4, Clicks: 1},
		{Date: "2026-07-02", Opens: 9, Clicks: 3},
	}}
	ts := newAnalyticsTestServer(t, a)
	token := newAuthToken(t)

	body := authGet(t, ts, token, "/api/v1/analytics/series?range=7d")
	series := body["series"].([]any)
	if len(series) != 2 {
		t.Fatalf("expected 2 series points, got %d", len(series))
	}
	first := series[0].(map[string]any)
	if first["date"] != "2026-07-01" || first["value"].(float64) != 4 || first["secondary"].(float64) != 1 {
		t.Fatalf("unexpected first point: %v", first)
	}
}

func TestAnalyticsOverviewAndHeatmap(t *testing.T) {
	a := &fakeAnalytics{
		series: []analytics.SeriesPoint{{Date: "2026-07-01", Opens: 2, Clicks: 1}},
		grid:   make([][]int64, 24),
	}
	ts := newAnalyticsTestServer(t, a)
	token := newAuthToken(t)

	overview := authGet(t, ts, token, "/api/v1/analytics/overview?range=30d")
	if totals := overview["totals"].(map[string]any); totals["recipients"].(float64) != 0 {
		t.Fatalf("unexpected totals: %v", totals)
	}
	if overview["analyticsAvailable"] != true {
		t.Fatal("analyticsAvailable should be true")
	}

	heatmap := authGet(t, ts, token, "/api/v1/analytics/heatmap?range=30d")
	if grid := heatmap["grid"].([]any); len(grid) != 24 {
		t.Fatalf("heatmap should have 24 rows, got %d", len(grid))
	}
}

func TestAnalyticsUnavailable(t *testing.T) {
	ts := newAnalyticsTestServer(t, nil)
	token := newAuthToken(t)
	req, _ := http.NewRequest("GET", ts.URL+"/api/v1/analytics/series", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("GET series: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when analytics not configured, got %d", resp.StatusCode)
	}
}
