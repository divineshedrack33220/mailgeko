package store

import (
	"encoding/json"
	"time"
)

const (
	ContactActive       = "active"
	ContactUnsubscribed = "unsubscribed"
	ContactBounced      = "bounced"
	ContactSpam         = "spam"

	CampaignDraft     = "draft"
	CampaignScheduled = "scheduled"
	CampaignSending   = "sending"
	CampaignSent      = "sent"
	CampaignCompleted = "completed"
	CampaignFailed    = "failed"
	CampaignPaused    = "paused"
)

type Contact struct {
	ID               string
	WorkspaceID      string
	Email            string
	FirstName        string
	LastName         string
	Company          string
	Position         string
	Country          string
	City             string
	PhoneNumber      string
	CustomFields     map[string]string
	Tags             []string
	Status           string
	LastEngagementAt *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type List struct {
	ID          string
	WorkspaceID string
	Name        string
	Description string
	CreatedAt   time.Time
}

type Segment struct {
	ID          string
	WorkspaceID string
	Name        string
	Description string
	MatchType   string
	Conditions  []Condition
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Condition struct {
	ID       string `json:"id"`
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type Template struct {
	ID          string
	WorkspaceID string
	Name        string
	Description string
	Category    string
	Thumbnail   string
	MJML        string
	HTML        string
	Variables   []string
	Tags        []string
	IsFavorite  bool
	UsedCount   int64
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Campaign struct {
	ID               string
	WorkspaceID      string
	Name             string
	Subject          string
	TemplateID       string
	PreviewText      string
	PlainText        string
	HTMLContent      string
	Status           string
	Type             string
	ListIDs          []string
	SegmentIDs       []string
	ScheduleAt       *time.Time
	FromName         string
	FromEmail        string
	ReplyTo          string
	TrackOpens       bool
	TrackClicks      bool
	AllowUnsubscribe bool
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type CampaignStats struct {
	CampaignID   string `db:"campaign_id"`
	Recipients   int64  `db:"recipients"`
	Sent         int64  `db:"sent"`
	Delivered    int64  `db:"delivered"`
	Opened       int64  `db:"opened"`
	Clicked      int64  `db:"clicked"`
	Bounced      int64  `db:"bounced"`
	Complained   int64  `db:"complained"`
	Unsubscribed int64  `db:"unsubscribed"`
	UniqueOpens  int64  `db:"unique_opens"`
	UniqueClicks int64  `db:"unique_clicks"`
}

type Automation struct {
	ID                string
	WorkspaceID       string
	Name              string
	Description       string
	TriggerType       string
	TriggerLabel      string
	TriggerConditions []Condition
	TriggerDelay      *int
	Steps             json.RawMessage
	Status            string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

func marshalJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("[]")
	}
	return b
}

func unmarshalStringSlice(b []byte) []string {
	if len(b) == 0 || string(b) == "null" {
		return []string{}
	}
	var out []string
	_ = json.Unmarshal(b, &out)
	if out == nil {
		out = []string{}
	}
	return out
}

func unmarshalStringMap(b []byte) map[string]string {
	if len(b) == 0 || string(b) == "null" {
		return map[string]string{}
	}
	out := make(map[string]string)
	_ = json.Unmarshal(b, &out)
	return out
}
