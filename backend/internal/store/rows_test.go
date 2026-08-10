package store

import (
	"database/sql"
	"reflect"
	"testing"
	"time"
)

func TestCampaignRowToCampaign(t *testing.T) {
	now := time.Now()
	schedule := now.Add(24 * time.Hour)
	r := campaignRow{
		ID:               "c1",
		WorkspaceID:      "ws",
		Name:             "N",
		Subject:          "S",
		TemplateID:       sql.NullString{String: "t1", Valid: true},
		PreviewText:      "P",
		PlainText:        "plain",
		HTMLContent:      "<p>html</p>",
		Status:           "draft",
		Type:             "regular",
		ListIDs:          []byte(`["l1","l2"]`),
		SegmentIDs:       []byte(`[]`),
		ScheduleAt:       &schedule,
		FromName:         "Mailgeko",
		FromEmail:        "mailgeko@clawmark.online",
		ReplyTo:          "hi@clawmark.online",
		TrackOpens:       true,
		TrackClicks:      true,
		AllowUnsubscribe: true,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	c := r.toCampaign()
	if c.ID != "c1" || c.TemplateID != "t1" || c.ScheduleAt != &schedule {
		t.Fatalf("basic fields lost: %+v", c)
	}
	if !reflect.DeepEqual(c.ListIDs, []string{"l1", "l2"}) || len(c.SegmentIDs) != 0 {
		t.Fatalf("list/segment ids wrong: %v %v", c.ListIDs, c.SegmentIDs)
	}
	if !c.TrackOpens || !c.TrackClicks || !c.AllowUnsubscribe {
		t.Fatalf("bool flags wrong: %+v", c)
	}
}

func TestCampaignRowNullTemplate(t *testing.T) {
	now := time.Now()
	c := (campaignRow{ID: "c1", CreatedAt: now, UpdatedAt: now}).toCampaign()
	if c.TemplateID != "" {
		t.Fatalf("invalid template id should map to empty, got %q", c.TemplateID)
	}
}

func TestContactRowToContact(t *testing.T) {
	engaged := time.Now()
	r := contactRow{
		ID:               "c1",
		WorkspaceID:      "ws",
		Email:            "a@b.co",
		FirstName:        "Ada",
		LastName:         "Lovelace",
		Company:          "Analytical Engines",
		CustomFields:     []byte(`{"title":"Countess"}`),
		Tags:             []byte(`["vip","trial"]`),
		Status:           ContactActive,
		LastEngagementAt: &engaged,
	}
	c := r.toContact()
	if c.Email != "a@b.co" || c.FirstName != "Ada" || c.Status != ContactActive {
		t.Fatalf("basic fields lost: %+v", c)
	}
	if !reflect.DeepEqual(c.Tags, []string{"vip", "trial"}) {
		t.Fatalf("tags wrong: %v", c.Tags)
	}
	if c.CustomFields["title"] != "Countess" {
		t.Fatalf("custom fields wrong: %v", c.CustomFields)
	}
	if c.LastEngagementAt != &engaged {
		t.Fatal("last engagement lost")
	}
}

func TestContactRowNilLists(t *testing.T) {
	now := time.Now()
	c := (contactRow{ID: "c1", CreatedAt: now, UpdatedAt: now}).toContact()
	if c.Tags == nil || len(c.Tags) != 0 {
		t.Fatalf("nil tags must map to empty slice, got %v", c.Tags)
	}
	if c.CustomFields == nil || len(c.CustomFields) != 0 {
		t.Fatalf("nil custom fields must map to empty map, got %v", c.CustomFields)
	}
}

func TestSegmentRowToSegment(t *testing.T) {
	now := time.Now()
	seg := (segmentRow{
		ID:         "s1",
		MatchType:  "all",
		Conditions: []byte(`[{"field":"country","operator":"eq","value":"DE"}]`),
		CreatedAt:  now,
		UpdatedAt:  now,
	}).toSegment()
	if seg.ID != "s1" || len(seg.Conditions) != 1 || seg.Conditions[0].Field != "country" {
		t.Fatalf("segment conversion wrong: %+v", seg)
	}
	empty := (segmentRow{ID: "s2"}).toSegment()
	if empty.Conditions == nil || len(empty.Conditions) != 0 {
		t.Fatalf("nil conditions must map to empty slice, got %v", empty.Conditions)
	}
}

func TestAutomationRunRowToRun(t *testing.T) {
	now := time.Now()
	run := (automationRunRow{
		ID:           "r1",
		WorkspaceID:  "ws",
		AutomationID: "a1",
		ContactID:    "c1",
		StepIndex:    2,
		RunAt:        now,
		Status:       AutomationRunActive,
		Attempts:     3,
		Error:        sql.NullString{String: "smtp refused", Valid: true},
		CreatedAt:    now,
		UpdatedAt:    now,
	}).toAutomationRun()
	if run.ID != "r1" || run.StepIndex != 2 || run.Attempts != 3 || run.Status != AutomationRunActive {
		t.Fatalf("run conversion wrong: %+v", run)
	}
	if run.Error != "smtp refused" {
		t.Fatalf("error not mapped, got %q", run.Error)
	}
	if nullErr := (automationRunRow{ID: "r2"}).toAutomationRun().Error; nullErr != "" {
		t.Fatalf("null error should map to empty, got %q", nullErr)
	}
}

func TestContactFilterDefaults(t *testing.T) {
	if f := (ContactFilter{}).withDefaults(); f.Limit != 50 {
		t.Fatalf("default limit = %d, want 50", f.Limit)
	}
	if f := (ContactFilter{Limit: 1000}).withDefaults(); f.Limit != 50 {
		t.Fatalf("over-limit clamps to 50, got %d", f.Limit)
	}
	if f := (ContactFilter{Limit: -1}).withDefaults(); f.Limit != 50 {
		t.Fatalf("negative limit clamps to 50, got %d", f.Limit)
	}
	if f := (ContactFilter{Limit: 100}).withDefaults(); f.Limit != 100 {
		t.Fatalf("valid limit preserved, got %d", f.Limit)
	}
}
