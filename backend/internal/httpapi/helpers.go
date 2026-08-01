package httpapi

import (
	"github.com/google/uuid"
)

type queueRecordEventPayload struct {
	WorkspaceID string `json:"workspace_id"`
	CampaignID  string `json:"campaign_id"`
	ContactID   string `json:"contact_id"`
	Type        string `json:"type"`
	URL         string `json:"url"`
	Device      string `json:"device"`
	Platform    string `json:"platform"`
	Country     string `json:"country"`
	CountryCode string `json:"country_code"`
	City        string `json:"city"`
	UserAgent   string `json:"user_agent"`
	IP          string `json:"ip"`
}

type queueImportCSVPayload struct {
	ImportID    string `json:"import_id"`
	WorkspaceID string `json:"workspace_id"`
	ListID      string `json:"list_id"`
	Path        string `json:"path"`
}

type queueEmbedContactPayload struct {
	WorkspaceID string `json:"workspace_id"`
	ContactID   string `json:"contact_id"`
}

type queueEmbedWorkspacePayload struct {
	WorkspaceID string `json:"workspace_id"`
}

func newID() string {
	return uuid.NewString()
}
