package scheduler

import (
	"context"
	"log"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

// CampaignEnqueuer pushes a campaign into the send queue.
type CampaignEnqueuer interface {
	EnqueueCampaignSend(ctx context.Context, campaignID string) error
}

// Scheduler periodically releases campaigns whose send time has arrived into
// the send queue. It claims each campaign atomically so a send is enqueued
// exactly once even if multiple scheduler instances are running.
type Scheduler struct {
	db       *store.Store
	queue    CampaignEnqueuer
	interval time.Duration
}

func New(db *store.Store, queue CampaignEnqueuer, interval time.Duration) *Scheduler {
	return &Scheduler{db: db, queue: queue, interval: interval}
}

// Run blocks until ctx is cancelled, ticking at the configured interval.
func (s *Scheduler) Run(ctx context.Context) {
	log.Printf("campaign scheduler started (every %s)", s.interval)
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("campaign scheduler stopped")
			return
		case now := <-t.C:
			s.releaseDue(ctx, now)
		}
	}
}

func (s *Scheduler) releaseDue(ctx context.Context, now time.Time) {
	due, err := s.db.ListDueScheduledCampaigns(ctx, now)
	if err != nil {
		log.Printf("scheduler: list due campaigns: %v", err)
		return
	}
	for _, c := range due {
		claimed, err := s.db.MarkCampaignScheduled(ctx, c.ID)
		if err != nil {
			log.Printf("scheduler: claim campaign %s: %v", c.ID, err)
			continue
		}
		if !claimed {
			continue
		}
		if err := s.queue.EnqueueCampaignSend(ctx, c.ID); err != nil {
			log.Printf("scheduler: enqueue campaign %s: %v", c.ID, err)
			continue
		}
		log.Printf("scheduler: released campaign %s (%q)", c.ID, c.Name)
	}
}
