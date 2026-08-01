package httpapi

import (
	"context"

	"github.com/divineshedrack33220/mailgeko/backend/internal/queue"
)

type queueClient struct {
	c *queue.Client
}

func NewQueueAdapter(c *queue.Client) CampaignEnqueuer {
	return &queueClient{c: c}
}

func (a *queueClient) EnqueueCampaignSend(ctx context.Context, campaignID string) error {
	return a.c.EnqueueCampaignSend(ctx, campaignID)
}

func (a *queueClient) EnqueueRecipientSend(ctx context.Context, campaignID, contactID string) error {
	return a.c.EnqueueRecipientSend(ctx, campaignID, contactID)
}

func (a *queueClient) EnqueueRecordEvent(ctx context.Context, p queueRecordEventPayload) error {
	return a.c.EnqueueRecordEvent(ctx, queue.RecordEventPayload(p))
}

func (a *queueClient) EnqueueImportCSV(ctx context.Context, p queueImportCSVPayload) error {
	return a.c.EnqueueImportCSV(ctx, queue.ImportCSVPayload(p))
}

func (a *queueClient) EnqueueEmbedContact(ctx context.Context, p queueEmbedContactPayload) error {
	return a.c.EnqueueEmbedContact(ctx, queue.EmbedContactPayload(p))
}

func (a *queueClient) EnqueueEmbedWorkspace(ctx context.Context, p queueEmbedWorkspacePayload) error {
	return a.c.EnqueueEmbedWorkspace(ctx, queue.EmbedWorkspacePayload(p))
}
