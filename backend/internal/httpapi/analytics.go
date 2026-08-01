package httpapi

import (
	"context"
	"net/http"

	"github.com/divineshedrack33220/mailgeko/backend/internal/analytics"
)

// AnalyticsStore is the subset of *analytics.Store the API needs, so handlers
// can be tested against a fake.
type AnalyticsStore interface {
	TopLinks(ctx context.Context, workspaceID string, days, limit int) ([]analytics.LinkStat, error)
	DeviceStats(ctx context.Context, workspaceID string, days int) ([]analytics.DeviceStat, error)
	CountryStats(ctx context.Context, workspaceID string, days int) ([]analytics.CountryStat, error)
	Series(ctx context.Context, workspaceID string, days int, monthly bool) ([]analytics.SeriesPoint, error)
	Heatmap(ctx context.Context, workspaceID string, days int) ([][]int64, error)
}

// analyticsRange converts a report range selector to (days, monthly) where
// monthly switches the series bucket from day to month.
func analyticsRange(r *http.Request) (days int, monthly bool) {
	switch r.URL.Query().Get("range") {
	case "7d":
		return 7, false
	case "90d":
		return 90, false
	case "12m":
		return 365, true
	default:
		return 30, false
	}
}

func (s *Server) requireAnalytics(w http.ResponseWriter, r *http.Request) bool {
	if s.analytics == nil {
		writeError(w, http.StatusServiceUnavailable, "analytics_unavailable",
			"analytics is not configured (set POSTGRES_DSN)")
		return false
	}
	return true
}

func (s *Server) handleAnalyticsOverview(w http.ResponseWriter, r *http.Request) {
	days, _ := analyticsRange(r)
	workspaceID := claimsFrom(r).GetWorkspaceID()

	totals := &struct {
		Recipients   int64 `json:"recipients"`
		Sent         int64 `json:"sent"`
		Delivered    int64 `json:"delivered"`
		Opened       int64 `json:"opened"`
		Clicked      int64 `json:"clicked"`
		Bounced      int64 `json:"bounced"`
		Complained   int64 `json:"complained"`
		Unsubscribed int64 `json:"unsubscribed"`
		UniqueOpens  int64 `json:"uniqueOpens"`
		UniqueClicks int64 `json:"uniqueClicks"`
	}{}

	if s.db != nil {
		if t, err := s.db.WorkspaceTotals(r.Context(), workspaceID); err == nil {
			totals.Recipients = t.Recipients
			totals.Sent = t.Sent
			totals.Delivered = t.Delivered
			totals.Opened = t.Opened
			totals.Clicked = t.Clicked
			totals.Bounced = t.Bounced
			totals.Complained = t.Complained
			totals.Unsubscribed = t.Unsubscribed
			totals.UniqueOpens = t.UniqueOpens
			totals.UniqueClicks = t.UniqueClicks
		}
	}

	out := map[string]any{
		"range":  r.URL.Query().Get("range"),
		"totals": totals,
		"rates": map[string]any{
			"deliverability":  pct(totals.Sent-totals.Bounced, totals.Sent),
			"openRate":        pct(totals.UniqueOpens, totals.Delivered),
			"clickRate":       pct(totals.UniqueClicks, totals.UniqueOpens),
			"bounceRate":      pct(totals.Bounced, totals.Sent),
			"unsubscribeRate": pct(totals.Unsubscribed, totals.Delivered),
		},
		"analyticsAvailable": s.analytics != nil,
	}

	if s.analytics != nil {
		if series, err := s.analytics.Series(r.Context(), workspaceID, days, days > 90); err == nil {
			out["series"] = toSeriesPayload(series)
		}
	}

	writeOK(w, out)
}

func (s *Server) handleAnalyticsSeries(w http.ResponseWriter, r *http.Request) {
	if !s.requireAnalytics(w, r) {
		return
	}
	days, monthly := analyticsRange(r)
	workspaceID := claimsFrom(r).GetWorkspaceID()
	series, err := s.analytics.Series(r.Context(), workspaceID, days, monthly)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load analytics series")
		return
	}
	writeOK(w, map[string]any{
		"range":  r.URL.Query().Get("range"),
		"series": toSeriesPayload(series),
	})
}

func (s *Server) handleAnalyticsLinks(w http.ResponseWriter, r *http.Request) {
	if !s.requireAnalytics(w, r) {
		return
	}
	days, _ := analyticsRange(r)
	workspaceID := claimsFrom(r).GetWorkspaceID()
	links, err := s.analytics.TopLinks(r.Context(), workspaceID, days, 5)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load top links")
		return
	}
	writeOK(w, map[string]any{
		"range": r.URL.Query().Get("range"),
		"links": orEmptySlice(links),
	})
}

func (s *Server) handleAnalyticsDevices(w http.ResponseWriter, r *http.Request) {
	if !s.requireAnalytics(w, r) {
		return
	}
	days, _ := analyticsRange(r)
	workspaceID := claimsFrom(r).GetWorkspaceID()
	devices, err := s.analytics.DeviceStats(r.Context(), workspaceID, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load device stats")
		return
	}
	writeOK(w, map[string]any{
		"range":   r.URL.Query().Get("range"),
		"devices": orEmptySlice(devices),
	})
}

func (s *Server) handleAnalyticsCountries(w http.ResponseWriter, r *http.Request) {
	if !s.requireAnalytics(w, r) {
		return
	}
	days, _ := analyticsRange(r)
	workspaceID := claimsFrom(r).GetWorkspaceID()
	countries, err := s.analytics.CountryStats(r.Context(), workspaceID, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load country stats")
		return
	}
	writeOK(w, map[string]any{
		"range":     r.URL.Query().Get("range"),
		"countries": orEmptySlice(countries),
	})
}

func (s *Server) handleAnalyticsHeatmap(w http.ResponseWriter, r *http.Request) {
	if !s.requireAnalytics(w, r) {
		return
	}
	days, _ := analyticsRange(r)
	workspaceID := claimsFrom(r).GetWorkspaceID()
	grid, err := s.analytics.Heatmap(r.Context(), workspaceID, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load send-time heatmap")
		return
	}
	writeOK(w, map[string]any{
		"range": r.URL.Query().Get("range"),
		"grid":  grid,
	})
}

func toSeriesPayload(series []analytics.SeriesPoint) []map[string]any {
	out := make([]map[string]any, 0, len(series))
	for _, p := range series {
		out = append(out, map[string]any{
			"date":      p.Date,
			"value":     p.Opens,
			"secondary": p.Clicks,
		})
	}
	return out
}

func pct(part, total int64) float64 {
	if total <= 0 {
		return 0
	}
	return round2(float64(part) / float64(total) * 100)
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}
