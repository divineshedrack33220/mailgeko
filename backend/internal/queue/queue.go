package queue

import (
	"context"
	"encoding/json"

	"github.com/hibiken/asynq"
)

const (
	TaskCampaignSend      = "send:campaign"
	TaskCampaignRecipient = "send:campaign:recipient"
	TaskRecordEvent       = "analytics:record_event"
	TaskImportCSV         = "import:csv"
	TaskEmbedContact      = "embed:contact"
	TaskEmbedWorkspace    = "embed:workspace"
)

type CampaignSendPayload struct {
	CampaignID string `json:"campaign_id"`
}

type CampaignRecipientPayload struct {
	CampaignID string `json:"campaign_id"`
	ContactID  string `json:"contact_id"`
}

type RecordEventPayload struct {
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

type ImportCSVPayload struct {
	ImportID    string `json:"import_id"`
	WorkspaceID string `json:"workspace_id"`
	ListID      string `json:"list_id"`
	Path        string `json:"path"`
}

type EmbedContactPayload struct {
	WorkspaceID string `json:"workspace_id"`
	ContactID   string `json:"contact_id"`
}

type EmbedWorkspacePayload struct {
	WorkspaceID string `json:"workspace_id"`
}

type Client struct {
	*asynq.Client
}

func NewClient(redisAddr string) *Client {
	return &Client{Client: asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})}
}

func (c *Client) EnqueueCampaignSend(ctx context.Context, campaignID string) error {
	payload, err := json.Marshal(CampaignSendPayload{CampaignID: campaignID})
	if err != nil {
		return err
	}
	_, err = c.EnqueueContext(ctx, asynq.NewTask(TaskCampaignSend, payload), asynq.Queue("critical"))
	return err
}

func (c *Client) EnqueueRecipientSend(ctx context.Context, campaignID, contactID string) error {
	payload, err := json.Marshal(CampaignRecipientPayload{CampaignID: campaignID, ContactID: contactID})
	if err != nil {
		return err
	}
	_, err = c.EnqueueContext(ctx, asynq.NewTask(TaskCampaignRecipient, payload), asynq.Queue("default"))
	return err
}

func (c *Client) EnqueueRecordEvent(ctx context.Context, p RecordEventPayload) error {
	payload, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = c.EnqueueContext(ctx, asynq.NewTask(TaskRecordEvent, payload), asynq.Queue("default"))
	return err
}

func (c *Client) EnqueueImportCSV(ctx context.Context, p ImportCSVPayload) error {
	payload, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = c.EnqueueContext(ctx, asynq.NewTask(TaskImportCSV, payload), asynq.Queue("low"))
	return err
}

func (c *Client) EnqueueEmbedContact(ctx context.Context, p EmbedContactPayload) error {
	payload, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = c.EnqueueContext(ctx, asynq.NewTask(TaskEmbedContact, payload), asynq.Queue("low"))
	return err
}

func (c *Client) EnqueueEmbedWorkspace(ctx context.Context, p EmbedWorkspacePayload) error {
	payload, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = c.EnqueueContext(ctx, asynq.NewTask(TaskEmbedWorkspace, payload), asynq.Queue("low"))
	return err
}
