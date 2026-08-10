package httpapi

import (
	"testing"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func TestCampaignResponsePadsAutomationSends(t *testing.T) {
	now := time.Now()
	c := &store.Campaign{ID: "c1", Type: "regular", CreatedAt: now, UpdatedAt: now}
	stats := &store.CampaignStats{
		CampaignID:     "c1",
		Recipients:     2,
		Sent:           2,
		AutoRecipients: 3,
		AutoSent:       3,
	}
	resp := campaignResponse(c, stats, 0)
	st := resp["stats"].(map[string]any)
	if got := st["recipients"].(int64); got != 5 {
		t.Errorf("regular campaign recipients = %d, want 5 (2 + 3 auto)", got)
	}
	if got := st["sent"].(int64); got != 5 {
		t.Errorf("regular campaign sent = %d, want 5 (2 + 3 auto)", got)
	}
}

func TestCampaignResponseNoStatsUsesZero(t *testing.T) {
	now := time.Now()
	c := &store.Campaign{ID: "c2", Type: "regular", CreatedAt: now, UpdatedAt: now}
	resp := campaignResponse(c, nil, 0)
	st := resp["stats"].(map[string]any)
	if got := st["recipients"].(int64); got != 0 {
		t.Errorf("nil stats recipients = %d, want 0", got)
	}
	if got := st["sent"].(int64); got != 0 {
		t.Errorf("nil stats sent = %d, want 0", got)
	}
}

func TestCampaignResponseAutomatedUsesRecipientCount(t *testing.T) {
	now := time.Now()
	c := &store.Campaign{ID: "c3", Type: "automated", CreatedAt: now, UpdatedAt: now}
	stats := &store.CampaignStats{
		CampaignID:     "c3",
		Recipients:     1,
		Sent:           1,
		AutoRecipients: 9,
		AutoSent:       9,
	}
	resp := campaignResponse(c, stats, 7)
	st := resp["stats"].(map[string]any)
	if got := st["recipients"].(int64); got != 7 {
		t.Errorf("automated campaign recipients = %d, want 7 (recipientCount)", got)
	}
	if got := st["sent"].(int64); got != 7 {
		t.Errorf("automated campaign sent = %d, want 7", got)
	}
}
