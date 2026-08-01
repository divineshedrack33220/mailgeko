package engine

import (
	"strings"
	"testing"

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
