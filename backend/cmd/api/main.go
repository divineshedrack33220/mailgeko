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
	"github.com/divineshedrack33220/mailgeko/backend/internal/cloudinary"
	"github.com/divineshedrack33220/mailgeko/backend/internal/config"
	"github.com/divineshedrack33220/mailgeko/backend/internal/database"
	"github.com/divineshedrack33220/mailgeko/backend/internal/embed"
	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
	"github.com/divineshedrack33220/mailgeko/backend/internal/httpapi"
	"github.com/divineshedrack33220/mailgeko/backend/internal/oauth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/queue"
	"github.com/divineshedrack33220/mailgeko/backend/internal/scheduler"
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

	if err := database.MigrateMySQL(ctx, tiDB); err != nil {
		log.Fatalf("migrate mysql: %v", err)
	}

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
	engine_.WithTrackingSecret(cfg.TrackingSecret)

	var analyticsStore httpapi.AnalyticsStore
	var searcher httpapi.ContactSearcher
	if cfg.PostgresDSN != "" {
		pg, err := database.ConnectPostgres(ctx, cfg.PostgresDSN)
		if err != nil {
			log.Printf("postgres analytics disabled (connect failed): %v", err)
		} else {
			defer pg.Close()
			if err := database.MigratePostgres(ctx, pg); err != nil {
				log.Printf("postgres analytics disabled (migrate failed): %v", err)
			} else {
				analyticsStore = analytics.New(pg)
				log.Println("postgres analytics connected")

				if em := embed.FromConfig(cfg.EmbedProvider, cfg.EmbedBaseURL, cfg.OpenAIKey, cfg.EmbedModel, cfg.EmbedDims); em != nil {
					engine_.WithEmbedding(vector.New(pg), em)
					searcher = engine_
					log.Printf("vector search enabled (provider=%s)", cfg.EmbedProvider)
				}
			}
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

	cloudinaryClient := cloudinary.New(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret, "")
	if cloudinaryClient.Enabled() {
		log.Printf("cloudinary uploads enabled (cloud=%s)", cfg.CloudinaryCloudName)
	} else {
		log.Println("cloudinary uploads disabled (no credentials)")
	}

	oauthManager := oauth.NewManager(cfg.BaseURL, cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GitHubClientID, cfg.GitHubClientSecret)
	if oauthManager.Enabled(oauth.Google) || oauthManager.Enabled(oauth.GitHub) {
		log.Println("oauth sign-in enabled")
	} else {
		log.Println("oauth sign-in disabled (no credentials)")
	}

	srv := httpapi.New(httpapi.Config{
		Env:                 cfg.Env,
		TokenTTL:            tokenTTL,
		HTTPAddr:            ":" + cfg.Port,
		BaseURL:             cfg.BaseURL,
		AllowedOrigins:      cfg.AllowedOrigins,
		TrackingSecret:      cfg.TrackingSecret,
		ResendWebhookSecret: cfg.ResendWebhookSecret,
		OpenAIKey:           cfg.OpenAIKey,
		OpenAIModel:         cfg.AIModel,
		OpenAIBaseURL:       cfg.AIBaseURL,
		Cloudinary:          cloudinaryClient,
		OAuth:               oauthManager,
	}, db, analyticsStore, manager, httpapi.NewSessionStore(rdb), queueAdapter, engine_, searcher, biller, rateLimit)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      srv.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	scheduler_ := scheduler.New(db, queueClient, 30*time.Second)
	go scheduler_.Run(ctx)

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
