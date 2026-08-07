package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/analytics"
	"github.com/divineshedrack33220/mailgeko/backend/internal/config"
	"github.com/divineshedrack33220/mailgeko/backend/internal/database"
	"github.com/divineshedrack33220/mailgeko/backend/internal/embed"
	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
	"github.com/divineshedrack33220/mailgeko/backend/internal/queue"
	"github.com/divineshedrack33220/mailgeko/backend/internal/sender"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
	"github.com/divineshedrack33220/mailgeko/backend/internal/vector"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	tiDB, err := database.ConnectTiDB(cfg.TiDBDSN)
	if err != nil {
		log.Fatalf("tidb: %v", err)
	}
	defer tiDB.Close()

	queueClient := queue.NewClient(cfg.RedisAddr)

	eng := engine.New(store.New(tiDB), sender.NewConfigured(cfg.ResendAPIKeys, cfg.ResendEndpoint), queueClient, cfg.BaseURL)
	eng.WithTrackingSecret(cfg.TrackingSecret)
	eng.WithDefaultSender(cfg.DefaultFromName, cfg.DefaultFromEmail)

	var eventLog *analytics.Store
	if cfg.PostgresDSN != "" {
		pg, err := database.ConnectPostgres(ctx, cfg.PostgresDSN)
		if err != nil {
			log.Fatalf("postgres: %v", err)
		}
		defer pg.Close()
		eventLog = analytics.New(pg)
		log.Println("postgres analytics connected")

		if em := embed.FromConfig(cfg.EmbedProvider, cfg.EmbedBaseURL, cfg.OpenAIKey, cfg.EmbedModel, cfg.EmbedDims); em != nil {
			eng.WithEmbedding(vector.New(pg), em)
			log.Printf("vector search enabled (provider=%s)", cfg.EmbedProvider)
		}
	}

	srv := queue.NewServer(cfg.RedisAddr)
	srv.HandleCampaignSend(eng.StartCampaign)
	srv.HandleCampaignRecipient(eng.SendToRecipient)
	srv.HandleRecordEvent(func(ctx context.Context, p queue.RecordEventPayload) error {
		if eventLog != nil {
			at := time.Now().UTC()
			_ = eventLog.RecordEvent(ctx, analytics.Event{
				WorkspaceID: p.WorkspaceID,
				CampaignID:  p.CampaignID,
				ContactID:   p.ContactID,
				Type:        analytics.EventType(p.Type),
				URL:         p.URL,
				Device:      p.Device,
				Platform:    p.Platform,
				Country:     p.Country,
				CountryCode: p.CountryCode,
				City:        p.City,
				UserAgent:   p.UserAgent,
				IP:          p.IP,
				OccurredAt:  at,
			})
		}
		return eng.RecordEvent(ctx, engine.EventInput{
			WorkspaceID: p.WorkspaceID,
			CampaignID:  p.CampaignID,
			ContactID:   p.ContactID,
			Type:        p.Type,
			URL:         p.URL,
		})
	})
	srv.HandleImportCSV(func(ctx context.Context, p queue.ImportCSVPayload) error {
		imported, updated, err := eng.ImportCSV(ctx, p.WorkspaceID, p.ListID, p.Path)
		if err != nil {
			log.Printf("import %s failed: %v", p.ImportID, err)
			return err
		}
		log.Printf("import %s done: %d imported, %d updated", p.ImportID, imported, updated)
		if eng.EmbeddingEnabled() {
			_ = queueClient.EnqueueEmbedWorkspace(ctx, queue.EmbedWorkspacePayload{WorkspaceID: p.WorkspaceID})
		}
		return nil
	})

	if eng.EmbeddingEnabled() {
		srv.HandleEmbedContact(func(ctx context.Context, p queue.EmbedContactPayload) error {
			if err := eng.EmbedContact(ctx, p.WorkspaceID, p.ContactID); err != nil {
				log.Printf("embed %s failed: %v", p.ContactID, err)
				return err
			}
			return nil
		})
		srv.HandleEmbedWorkspace(func(ctx context.Context, p queue.EmbedWorkspacePayload) error {
			if err := eng.EmbedWorkspace(ctx, p.WorkspaceID); err != nil {
				log.Printf("embed workspace %s failed: %v", p.WorkspaceID, err)
				return err
			}
			return nil
		})
	}

	go func() {
		<-ctx.Done()
		log.Println("shutting down worker...")
		srv.Shutdown()
	}()

	log.Println("worker listening for tasks")
	if err := srv.Start(); err != nil {
		log.Fatalf("worker: %v", err)
	}
}
