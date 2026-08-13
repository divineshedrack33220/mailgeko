// Command migrate applies pending schema migrations without starting the API.
// Use it when AUTO_MIGRATE=false so multiple API replicas never race to apply
// schema changes:
//
//	go run ./cmd/migrate
package main

import (
	"context"
	"log"
	"log/slog"
	"os"

	"github.com/divineshedrack33220/mailgeko/backend/internal/config"
	"github.com/divineshedrack33220/mailgeko/backend/internal/database"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	ctx := context.Background()

	if cfg.AutoMigrate {
		logger.Info("AUTO_MIGRATE=true; nothing to do — the API applies migrations at startup")
		return
	}

	tiDB, err := database.ConnectTiDB(cfg.TiDBDSN)
	if err != nil {
		logger.Error("connect tidb", "error", err)
		os.Exit(1)
	}
	defer tiDB.Close()
	if err := database.MigrateMySQL(ctx, tiDB); err != nil {
		logger.Error("migrate mysql", "error", err)
		os.Exit(1)
	}

	if cfg.PostgresDSN != "" {
		pg, err := database.ConnectPostgres(ctx, cfg.PostgresDSN)
		if err != nil {
			logger.Error("connect postgres", "error", err)
			os.Exit(1)
		}
		defer pg.Close()
		if err := database.MigratePostgres(ctx, pg); err != nil {
			logger.Error("migrate postgres", "error", err)
			os.Exit(1)
		}
	}

	logger.Info("migrations complete")
}
