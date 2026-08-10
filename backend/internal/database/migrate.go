package database

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jmoiron/sqlx"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// postgresMigrations are the Postgres / pgvector migrations, in order. They are
// the only files excluded from the MySQL run; everything else in migrations/ is
// applied to TiDB automatically.
var postgresMigrations = []string{
	"migrations/0003_analytics.sql",
	"migrations/0004_analytics_enrichment.sql",
	"migrations/0005_embeddings.sql",
}

// mysqlMigrations returns the TiDB / MySQL migration files in order. The list
// is derived from the embedded filesystem, so a new migrations/NNNN_*.sql file
// is picked up automatically — there is no registry to update by hand.
func mysqlMigrations() ([]string, error) {
	postgres := make(map[string]bool, len(postgresMigrations))
	for _, n := range postgresMigrations {
		postgres[n] = true
	}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return nil, fmt.Errorf("list migrations: %w", err)
	}
	var out []string
	for _, e := range entries {
		name := "migrations/" + e.Name()
		if postgres[name] {
			continue
		}
		out = append(out, name)
	}
	sort.Strings(out)
	return out, nil
}

// MigrateMySQL applies any not-yet-run MySQL migrations to the TiDB store.
// It is idempotent: applied migrations are recorded in schema_migrations.
func MigrateMySQL(ctx context.Context, db *sqlx.DB) error {
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		id INT AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(255) NOT NULL UNIQUE,
		applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	migrations, err := mysqlMigrations()
	if err != nil {
		return err
	}
	for _, name := range migrations {
		var applied int
		if err := db.GetContext(ctx, &applied,
			`SELECT COUNT(*) FROM schema_migrations WHERE name = ?`, name); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied > 0 {
			continue
		}
		sqlBytes, err := migrationsFS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		tx, err := db.BeginTxx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, string(sqlBytes)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO schema_migrations (name) VALUES (?)`, name); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", name, err)
		}
		log.Printf("migration applied (mysql): %s", name)
	}
	return nil
}

// MigratePostgres applies any not-yet-run Postgres migrations. It is idempotent.
func MigratePostgres(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		id SERIAL PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	for _, name := range postgresMigrations {
		var applied bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1)`, name).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied {
			continue
		}
		sqlBytes, err := migrationsFS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO schema_migrations (name) VALUES ($1)`, name); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", name, err)
		}
		log.Printf("migration applied (postgres): %s", name)
	}
	return nil
}

// ensureMultiStatements appends multiStatements=true to a MySQL DSN so embedded
// migration files (which contain multiple statements) can execute in one call.
func ensureMultiStatements(dsn string) string {
	if dsn == "" || strings.Contains(strings.ToLower(dsn), "multistatements") {
		return dsn
	}
	if idx := strings.Index(dsn, "?"); idx >= 0 {
		return dsn[:idx+1] + "multiStatements=true&" + dsn[idx+1:]
	}
	return dsn + "?multiStatements=true"
}
