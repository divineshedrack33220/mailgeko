package main

import (
	"context"
	"log"
	"log/slog"
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
	"github.com/divineshedrack33220/mailgeko/backend/internal/crypto"
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

	logger := newLogger(cfg.Env)
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	tiDB, err := database.ConnectTiDB(cfg.TiDBDSN)
	if err != nil {
		logger.Error("connect tidb", "error", err)
		os.Exit(1)
	}
	defer tiDB.Close()

	if cfg.AutoMigrate {
		if err := database.MigrateMySQL(ctx, tiDB); err != nil {
			logger.Error("migrate mysql", "error", err)
			os.Exit(1)
		}
	} else {
		logger.Info("automatic migrations disabled (AUTO_MIGRATE=false)")
	}

	rdb, err := database.ConnectRedis(ctx, cfg.RedisAddr)
	if err != nil {
		logger.Error("connect redis", "error", err)
		os.Exit(1)
	}
	defer rdb.Close()

	queueClient := queue.NewClient(cfg.RedisAddr)
	queueAdapter := httpapi.NewQueueAdapter(queueClient)

	tokenTTL := 24 * time.Hour
	manager := auth.NewTokenManager(cfg.JWTSecret, tokenTTL)

	db := store.New(tiDB)
	engine_ := engine.New(db, sender.NewConfigured(cfg.ResendAPIKeys, cfg.ResendEndpoint), queueAdapter, cfg.BaseURL)
	engine_.WithTrackingSecret(cfg.TrackingSecret)
	engine_.WithDefaultSender(cfg.DefaultFromName, cfg.DefaultFromEmail)
	engine_.WithAllowedFromDomains(cfg.AllowedFromDomains...)
	if enc, err := crypto.New(cfg.SecretKey); err == nil {
		engine_.WithEncryptor(enc)
	} else if cfg.SecretKey != "" {
		logger.Error("crypto", "error", err)
		os.Exit(1)
	} else {
		logger.Info("MAILGEKO_SECRET_KEY unset; BYO-SMTP disabled")
	}

	var analyticsStore httpapi.AnalyticsStore
	var searcher httpapi.ContactSearcher
	if cfg.PostgresDSN != "" {
		pg, err := database.ConnectPostgres(ctx, cfg.PostgresDSN)
		if err != nil {
			logger.Warn("postgres analytics disabled (connect failed)", "error", err)
		} else {
			defer pg.Close()
			if err := database.MigratePostgres(ctx, pg); err != nil {
				logger.Warn("postgres analytics disabled (migrate failed)", "error", err)
			} else {
				analyticsStore = analytics.New(pg)
				logger.Info("postgres analytics connected")

				if em := embed.FromConfig(cfg.EmbedProvider, cfg.EmbedBaseURL, cfg.OpenAIKey, cfg.EmbedModel, cfg.EmbedDims); em != nil {
					engine_.WithEmbedding(vector.New(pg), em)
					searcher = engine_
					logger.Info("vector search enabled", "provider", cfg.EmbedProvider)
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
	logger.Info("billing enabled", "provider", provider)

	cloudinaryClient := cloudinary.New(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret, "")
	if cloudinaryClient.Enabled() {
		logger.Info("cloudinary uploads enabled", "cloud", cfg.CloudinaryCloudName)
	} else {
		logger.Info("cloudinary uploads disabled (no credentials)")
	}

	oauthManager := oauth.NewManager(cfg.BaseURL, cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GitHubClientID, cfg.GitHubClientSecret)
	if oauthManager.Enabled(oauth.Google) || oauthManager.Enabled(oauth.GitHub) {
		logger.Info("oauth sign-in enabled")
	} else {
		logger.Info("oauth sign-in disabled (no credentials)")
	}

	srv := httpapi.New(httpapi.Config{
		Env:                 cfg.Env,
		TokenTTL:            tokenTTL,
		HTTPAddr:            ":" + cfg.Port,
		BaseURL:             cfg.BaseURL,
		AllowedOrigins:      cfg.AllowedOrigins,
		TrustedProxyCIDRs:   cfg.TrustedProxyCIDRs,
		TrackingSecret:      cfg.TrackingSecret,
		ResendWebhookSecret: cfg.ResendWebhookSecret,
		OpenAIKey:           cfg.OpenAIKey,
		OpenAIModel:         cfg.AIModel,
		OpenAIBaseURL:       cfg.AIBaseURL,
		Cloudinary:          cloudinaryClient,
		OAuth:               oauthManager,
		Logger:              logger,
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
		logger.Info("api listening", "port", cfg.Port, "env", cfg.Env)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("http server", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down api...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Warn("shutdown", "error", err)
	}
}

// newLogger builds a structured logger whose verbosity depends on APP_ENV.
// Production logs JSON for easy ingestion by log aggregators; development uses
// human-readable text.
func newLogger(env string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: slog.LevelInfo}
	if env == "development" {
		opts.Level = slog.LevelDebug
	}
	if env == "production" {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}
