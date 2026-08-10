package engine

import (
	"strings"
	"testing"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func TestSubstitute(t *testing.T) {
	vars := map[string]string{"first_name": "Sarah", "company": "Acme Corp"}
	got := Substitute("Hi {first_name} at {company}", vars)
	want := "Hi Sarah at Acme Corp"
	if got != want {
		t.Errorf("Substitute = %q, want %q", got, want)
	}
}

func TestSubstituteDoubleBraces(t *testing.T) {
	vars := map[string]string{"first_name": "Sarah", "last_name": "Lee"}
	got := Substitute("Hi {{first_name}} {{last_name}}!", vars)
	want := "Hi Sarah Lee!"
	if got != want {
		t.Errorf("Substitute(double braces) = %q, want %q", got, want)
	}
	got = Substitute("Hi {first_name} and {{first_name}}", vars)
	want = "Hi Sarah and Sarah"
	if got != want {
		t.Errorf("Substitute(mixed) = %q, want %q", got, want)
	}
}

func TestRenderHTML(t *testing.T) {
	html := `<html><body><h1>Hello {first_name}</h1><a href="https://example.com/pricing">Pricing</a></body></html>`
	got := RenderHTML(html, map[string]string{"first_name": "Ada"}, RenderOptions{
		BaseURL:          "https://mailgeko.example",
		TrackOpens:       true,
		TrackClicks:      true,
		AllowUnsubscribe: true,
		CampaignID:       "cmp-1",
		ContactID:        "c-1",
	})

	if strings.Contains(got, "{first_name}") {
		t.Errorf("variable not substituted: %s", got)
	}
	if !strings.Contains(got, "/track/open?c=cmp-1&m=c-1") {
		t.Errorf("open pixel missing: %s", got)
	}
	if !strings.Contains(got, "/track/click?c=cmp-1&m=c-1&u=") {
		t.Errorf("click link not wrapped: %s", got)
	}
	if !strings.Contains(got, "/track/unsubscribe?c=cmp-1&m=c-1") {
		t.Errorf("unsubscribe link missing: %s", got)
	}
}

func TestRenderHTMLNoTracking(t *testing.T) {
	html := `<a href="https://example.com">x</a>`
	got := RenderHTML(html, nil, RenderOptions{})
	if !strings.Contains(got, `href="https://example.com"`) {
		t.Errorf("href should be unchanged when tracking off: %s", got)
	}
}

func TestUnsubscribeURL(t *testing.T) {
	if u := UnsubscribeURL(RenderOptions{AllowUnsubscribe: false}); u != "" {
		t.Errorf("UnsubscribeURL should be empty when disabled, got %q", u)
	}
	u := UnsubscribeURL(RenderOptions{
		BaseURL:          "https://mailgeko.example",
		AllowUnsubscribe: true,
		CampaignID:       "cmp-1",
		ContactID:        "c-1",
		SigningKey:       "secret",
	})
	if !strings.HasPrefix(u, "https://mailgeko.example/track/unsubscribe?") {
		t.Errorf("unexpected unsubscribe URL: %q", u)
	}
	if !strings.Contains(u, "c=cmp-1") || !strings.Contains(u, "m=c-1") || !strings.Contains(u, "s=") {
		t.Errorf("unsubscribe URL missing params: %q", u)
	}
}

func TestSegmentAll(t *testing.T) {
	seg := &store.Segment{
		MatchType: "all",
		Conditions: []store.Condition{
			{Field: "status", Operator: "is", Value: "active"},
			{Field: "tags", Operator: "contains", Value: "enterprise"},
		},
	}
	match := &store.Contact{Status: "active", Tags: []string{"enterprise", "webinar"}}
	if !segmentMatches(seg, match) {
		t.Error("expected contact to match segment")
	}
	noMatch := &store.Contact{Status: "active", Tags: []string{"pro"}}
	if segmentMatches(seg, noMatch) {
		t.Error("expected contact not to match segment")
	}
}

func TestSegmentAny(t *testing.T) {
	seg := &store.Segment{
		MatchType: "any",
		Conditions: []store.Condition{
			{Field: "status", Operator: "is", Value: "bounced"},
			{Field: "country", Operator: "is", Value: "Nigeria"},
		},
	}
	c := &store.Contact{Status: "active", Country: "Nigeria"}
	if !segmentMatches(seg, c) {
		t.Error("expected 'any' match on country")
	}
}

func TestSegmentCustomField(t *testing.T) {
	seg := &store.Segment{
		MatchType: "all",
		Conditions: []store.Condition{
			{Field: "custom.plan", Operator: "is", Value: "enterprise"},
		},
	}
	c := &store.Contact{CustomFields: map[string]string{"plan": "enterprise"}}
	if !segmentMatches(seg, c) {
		t.Error("expected custom field match")
	}
}

func TestResolveFromFallsBackOnUnverifiedDomain(t *testing.T) {
	e := New(nil, nil, nil, "").
		WithDefaultSender("Mailgeko", "mailgeko@clawmark.online").
		WithAllowedFromDomains("clawmark.online")

	if got := e.resolveFrom("Grace Lee", "divineshedrack1@gmail.com"); got != "Mailgeko <mailgeko@clawmark.online>" {
		t.Fatalf("gmail sender should fall back to default, got %q", got)
	}
	if got := e.resolveFrom("Grace Lee", ""); got != "Mailgeko <mailgeko@clawmark.online>" {
		t.Fatalf("empty sender should fall back to default, got %q", got)
	}
	if got := e.resolveFrom("Mailgeko", "mailgeko@clawmark.online"); got != "Mailgeko <mailgeko@clawmark.online>" {
		t.Fatalf("verified sender should be used, got %q", got)
	}
	if got := e.resolveFrom("Mailgeko", "noatsign"); got != "Mailgeko <mailgeko@clawmark.online>" {
		t.Fatalf("malformed sender should fall back to default, got %q", got)
	}
}

func TestAutomationDelayDefault(t *testing.T) {
	if d := automationDelay(nil); d != 24*time.Hour {
		t.Fatalf("nil config should default to 1 day, got %v", d)
	}
	if d := automationDelay(map[string]any{}); d != 24*time.Hour {
		t.Fatalf("empty config should default to 1 day, got %v", d)
	}
	if d := automationDelay(map[string]any{"duration": 0}); d != 24*time.Hour {
		t.Fatalf("zero duration should default to 1 day, got %v", d)
	}
	if d := automationDelay(map[string]any{"duration": 3.0}); d != 3*24*time.Hour {
		t.Fatalf("duration without unit should default to days, got %v", d)
	}
}

func TestAutomationDelayUnits(t *testing.T) {
	cases := []struct {
		cfg  map[string]any
		want time.Duration
	}{
		{map[string]any{"duration": 30.0, "unit": "minutes"}, 30 * time.Minute},
		{map[string]any{"duration": 12.0, "unit": "hours"}, 12 * time.Hour},
		{map[string]any{"duration": 5.0, "unit": "days"}, 5 * 24 * time.Hour},
		{map[string]any{"duration": 2.0, "unit": "weeks"}, 14 * 24 * time.Hour},
		{map[string]any{"duration": 1.5, "unit": "hour"}, 90 * time.Minute},
	}
	for _, tc := range cases {
		if got := automationDelay(tc.cfg); got != tc.want {
			t.Errorf("automationDelay(%v) = %v, want %v", tc.cfg, got, tc.want)
		}
	}
}

