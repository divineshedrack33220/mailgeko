package scheduler

import (
	"context"
	"log"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

// CampaignEnqueuer pushes work into the send queue: both scheduled campaigns
// and due automation runs.
type CampaignEnqueuer interface {
	EnqueueCampaignSend(ctx context.Context, campaignID string) error
	EnqueueAutomationRun(ctx context.Context, runID string) error
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
			s.recoverStuckCampaigns(ctx, now)
			s.releaseDue(ctx, now)
			s.releaseDueAutomationRuns(ctx, now)
		}
	}
}

// recoverStuckCampaigns resets campaigns stuck in 'sending' for longer than
// the timeout. This handles worker crashes mid-send: the campaign is left in
// 'sending' with no active worker, and the scheduler would never pick it up
// again. Resetting to 'failed' lets the user retry.
func (s *Scheduler) recoverStuckCampaigns(ctx context.Context, now time.Time) {
	const stuckTimeout = 30 * time.Minute
	n, err := s.db.RecoverStuckSendingCampaigns(ctx, now, stuckTimeout)
	if err != nil {
		log.Printf("scheduler: recover stuck campaigns: %v", err)
		return
	}
	if n > 0 {
		log.Printf("scheduler: recovered %d stuck campaign(s)", n)
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
			// Roll the claim back so the campaign is retried on the next tick
			// instead of sitting in 'sending' with no worker to finish it.
			_ = s.db.SetCampaignStatus(ctx, c.WorkspaceID, c.ID, c.Status)
			continue
		}
		log.Printf("scheduler: released campaign %s (%q)", c.ID, c.Name)
	}
}

// releaseDueAutomationRuns hands due automation runs to the worker. Each run
// is claimed atomically with a lease so a crashed worker's run is retried
// once the lease expires.
func (s *Scheduler) releaseDueAutomationRuns(ctx context.Context, now time.Time) {
	const (
		lease        = 15 * time.Minute
		maxBatchSize = 1000
	)
	due, err := s.db.ListDueAutomationRuns(ctx, now, maxBatchSize)
	if err != nil {
		log.Printf("scheduler: list due automation runs: %v", err)
		return
	}
	for _, run := range due {
		claimed, err := s.db.ClaimAutomationRun(ctx, run.ID, now, lease)
		if err != nil {
			log.Printf("scheduler: claim automation run %s: %v", run.ID, err)
			continue
		}
		if !claimed {
			continue
		}
		if err := s.queue.EnqueueAutomationRun(ctx, run.ID); err != nil {
			log.Printf("scheduler: enqueue automation run %s: %v", run.ID, err)
			continue
		}
		log.Printf("scheduler: released automation run %s", run.ID)
	}
}
