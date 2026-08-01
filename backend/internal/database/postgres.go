package database

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func ConnectPostgres(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	poolCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(poolCtx, dsn)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}
