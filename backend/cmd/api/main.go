package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/analytics"
	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/billing"
	"github.com/divineshedrack33220/mailgeko/backend/internal/config"
	"github.com/divineshedrack33220/mailgeko/backend/internal/database"
	"github.com/divineshedrack33220/mailgeko/backend/internal/embed"
	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
	"github.com/divineshedrack33220/mailgeko/backend/internal/httpapi"
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

	rdb, err := database.ConnectRedis(ctx, cfg.RedisAddr)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer rdb.Close()

	queueClient := queue.NewClient(cfg.RedisAddr)
	queueAdapter := httpapi.NewQueueAdapter(queueClient)

	tokenTTL := 24 * time.Hour
	manager := auth.NewTokenManager(cfg.JWTSecret, tokenTTL)

	db := store.New(tiDB)
	engine_ := engine.New(db, sender.NewConfigured(cfg.ResendAPIKeys, cfg.ResendEndpoint), queueAdapter, cfg.BaseURL)

	var analyticsStore httpapi.AnalyticsStore
	var searcher httpapi.ContactSearcher
	if cfg.PostgresDSN != "" {
		pg, err := database.ConnectPostgres(ctx, cfg.PostgresDSN)
		if err != nil {
			log.Fatalf("postgres: %v", err)
		}
		defer pg.Close()
		analyticsStore = analytics.New(pg)
		log.Println("postgres analytics connected")

		if em := embed.FromConfig(cfg.EmbedProvider, cfg.EmbedBaseURL, cfg.OpenAIKey, cfg.EmbedModel, cfg.EmbedDims); em != nil {
			engine_.WithEmbedding(vector.New(pg), em)
			searcher = engine_
			log.Printf("vector search enabled (provider=%s)", cfg.EmbedProvider)
		}
	}

	rateLimit := httpapi.NewRateLimiter(rdb, 300, time.Minute)

	provider := cfg.BillingProvider
	if provider == "" {
		if cfg.StripeKey != "" {
			provider = "stripe"
		} else {
			provider = "local"
		}
	}
	var gateway billing.Gateway
	switch provider {
	case "stripe":
		gateway = billing.NewStripe(billing.StripeConfig{
			APIKey:        cfg.StripeKey,
			WebhookSecret: cfg.StripeWebhookSecret,
			Prices:        cfg.StripePrices,
		})
	default:
		gateway = billing.NewLocal(cfg.StripeWebhookSecret, cfg.BaseURL)
	}
	biller := billing.NewService(db, gateway, cfg.BaseURL)
	log.Printf("billing enabled (provider=%s)", provider)

	srv := httpapi.New(httpapi.Config{
		Env:           cfg.Env,
		TokenTTL:      tokenTTL,
		HTTPAddr:      ":" + cfg.Port,
		BaseURL:       cfg.BaseURL,
		OpenAIKey:     cfg.OpenAIKey,
		OpenAIModel:   cfg.AIModel,
		OpenAIBaseURL: cfg.AIBaseURL,
	}, db, analyticsStore, manager, httpapi.NewSessionStore(rdb), queueAdapter, engine_, searcher, biller, rateLimit)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      srv.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("api listening on :%s (env=%s)", cfg.Port, cfg.Env)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down api...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
