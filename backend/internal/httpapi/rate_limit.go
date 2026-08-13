package httpapi

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	rdb    *redis.Client
	limit  int
	window time.Duration
}

func NewRateLimiter(rdb *redis.Client, limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{rdb: rdb, limit: limit, window: window}
}

func (rl *RateLimiter) Allow(ctx context.Context, key string) (bool, int64) {
	redisKey := "ratelimit:" + key
	now := time.Now().Unix()
	windowStart := now - int64(rl.window.Seconds())
	member := fmt.Sprintf("%d-%d", now, time.Now().UnixNano())

	_, err := rl.rdb.ZRemRangeByScore(ctx, redisKey, "0", strconv.FormatInt(windowStart, 10)).Result()
	if err != nil {
		return true, 0
	}

	pipe := rl.rdb.TxPipeline()
	pipe.ZAdd(ctx, redisKey, redis.Z{Score: float64(now), Member: member})
	pipe.ZRemRangeByScore(ctx, redisKey, "0", strconv.FormatInt(windowStart, 10))
	pipe.Expire(ctx, redisKey, rl.window+time.Second)
	countCmd := pipe.ZCard(ctx, redisKey)
	if _, err := pipe.Exec(ctx); err != nil {
		return true, 0
	}

	count := countCmd.Val()
	if count > int64(rl.limit) {
		return false, int64(rl.limit)
	}
	return true, count
}

// AllowFixed is a fixed-window limiter (INCR + EXPIRE) used for cheap per-user
// checks on top of the sliding-window IP limiter. It is not used for the
// primary limiter because the sliding window is fairer under bursts.
func (rl *RateLimiter) AllowFixed(ctx context.Context, key string) bool {
	if rl == nil {
		return true
	}
	redisKey := "ratelimit:" + key
	n, err := rl.rdb.Incr(ctx, redisKey).Result()
	if err != nil {
		return true
	}
	if n == 1 {
		rl.rdb.Expire(ctx, redisKey, rl.window)
	}
	return n <= int64(rl.limit)
}
