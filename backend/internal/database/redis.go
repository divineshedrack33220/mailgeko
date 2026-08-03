package database

import (
	"context"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/queue"
	"github.com/redis/go-redis/v9"
)

func ConnectRedis(ctx context.Context, addr string) (*redis.Client, error) {
	rdb := redis.NewClient(queue.ParseRedisAddr(addr).GoRedis())

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return nil, err
	}
	return rdb, nil
}
