package analytics

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type EventType string

const (
	EventDelivered    EventType = "delivered"
	EventOpened       EventType = "opened"
	EventClicked      EventType = "clicked"
	EventBounced      EventType = "bounced"
	EventComplained   EventType = "complained"
	EventUnsubscribed EventType = "unsubscribed"
)

type Event struct {
	WorkspaceID string
	CampaignID  string
	ContactID   string
	Type        EventType
	URL         string
	Device      string
	Platform    string
	Country     string
	CountryCode string
	City        string
	UserAgent   string
	IP          string
	OccurredAt  time.Time
}

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) RecordEvent(ctx context.Context, e Event) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO email_events
			(workspace_id, campaign_id, contact_id, type, url, device, platform,
			 country, country_code, city, user_agent, ip, occurred_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		e.WorkspaceID, e.CampaignID, e.ContactID, string(e.Type), nullStr(e.URL),
		nullStr(e.Device), nullStr(e.Platform), nullStr(e.Country), nullStr(e.CountryCode),
		nullStr(e.City), nullStr(e.UserAgent), nullStr(e.IP), e.OccurredAt)
	return err
}

func (s *Store) CountEvents(ctx context.Context, campaignID string, eventType EventType) (int64, error) {
	var n int64
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM email_events WHERE campaign_id = $1 AND type = $2`,
		campaignID, string(eventType)).Scan(&n)
	return n, err
}

func (s *Store) DailySeries(ctx context.Context, campaignID string, eventType EventType, days int) ([]DayCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT date_trunc('day', occurred_at)::date AS day, COUNT(*)
		FROM email_events
		WHERE campaign_id = $1 AND type = $2 AND occurred_at >= now() - ($3 * interval '1 day')
		GROUP BY day ORDER BY day`, campaignID, string(eventType), days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DayCount
	for rows.Next() {
		var d DayCount
		if err := rows.Scan(&d.Day, &d.Count); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

type DayCount struct {
	Day   time.Time
	Count int64
}

type LinkStat struct {
	URL    string `json:"url"`
	Clicks int64  `json:"clicks"`
}

type DeviceStat struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

type CountryStat struct {
	Country string `json:"country"`
	Code    string `json:"code"`
	Opens   int64  `json:"opens"`
}

type SeriesPoint struct {
	Date   string `json:"date"`
	Opens  int64  `json:"opens"`
	Clicks int64  `json:"clicks"`
}

func (s *Store) TopLinks(ctx context.Context, workspaceID string, days, limit int) ([]LinkStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(url, '') AS url, COUNT(*) AS clicks
		FROM email_events
		WHERE workspace_id = $1 AND type = 'clicked' AND occurred_at >= now() - ($2 * interval '1 day')
		GROUP BY url ORDER BY clicks DESC LIMIT $3`,
		workspaceID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []LinkStat
	for rows.Next() {
		var l LinkStat
		if err := rows.Scan(&l.URL, &l.Clicks); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) DeviceStats(ctx context.Context, workspaceID string, days int) ([]DeviceStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(NULLIF(device, ''), 'Unknown') AS device, COUNT(*) AS count
		FROM email_events
		WHERE workspace_id = $1 AND type = 'opened' AND occurred_at >= now() - ($2 * interval '1 day')
		GROUP BY device ORDER BY count DESC`,
		workspaceID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DeviceStat
	for rows.Next() {
		var d DeviceStat
		if err := rows.Scan(&d.Name, &d.Count); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) CountryStats(ctx context.Context, workspaceID string, days int) ([]CountryStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS country,
		       COALESCE(NULLIF(country_code, ''), '') AS code,
		       COUNT(*) AS opens
		FROM email_events
		WHERE workspace_id = $1 AND type = 'opened' AND occurred_at >= now() - ($2 * interval '1 day')
		GROUP BY country, country_code ORDER BY opens DESC`,
		workspaceID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CountryStat
	for rows.Next() {
		var c CountryStat
		if err := rows.Scan(&c.Country, &c.Code, &c.Opens); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// Series returns the daily (or monthly) open/click counts for the workspace.
// day bucket is used for ranges up to 90 days; month for longer ranges.
func (s *Store) Series(ctx context.Context, workspaceID string, days int, monthly bool) ([]SeriesPoint, error) {
	bucket := `date_trunc('day', occurred_at)::date`
	if monthly {
		bucket = `date_trunc('month', occurred_at)::date`
	}
	rows, err := s.pool.Query(ctx, `
		SELECT `+bucket+` AS day,
		       COUNT(*) FILTER (WHERE type = 'opened') AS opens,
		       COUNT(*) FILTER (WHERE type = 'clicked') AS clicks
		FROM email_events
		WHERE workspace_id = $1 AND occurred_at >= now() - ($2 * interval '1 day')
		GROUP BY day ORDER BY day`, workspaceID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SeriesPoint
	for rows.Next() {
		var d time.Time
		var p SeriesPoint
		if err := rows.Scan(&d, &p.Opens, &p.Clicks); err != nil {
			return nil, err
		}
		p.Date = d.Format("2006-01-02")
		out = append(out, p)
	}
	return out, rows.Err()
}

// Heatmap returns a 24x7 grid of open counts indexed by [hour][weekday]
// where weekday 0 = Monday. Missing cells are zero.
func (s *Store) Heatmap(ctx context.Context, workspaceID string, days int) ([][]int64, error) {
	grid := make([][]int64, 24)
	for h := range grid {
		grid[h] = make([]int64, 7)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT extract(hour FROM occurred_at)::int AS hour,
		       to_char(occurred_at, 'ID')::int - 1 AS weekday,
		       COUNT(*) AS opens
		FROM email_events
		WHERE workspace_id = $1 AND type = 'opened' AND occurred_at >= now() - ($2 * interval '1 day')
		GROUP BY hour, weekday`, workspaceID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var hour, weekday int
		var opens int64
		if err := rows.Scan(&hour, &weekday, &opens); err != nil {
			return nil, err
		}
		if hour >= 0 && hour < 24 && weekday >= 0 && weekday < 7 {
			grid[hour][weekday] = opens
		}
	}
	return grid, rows.Err()
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
