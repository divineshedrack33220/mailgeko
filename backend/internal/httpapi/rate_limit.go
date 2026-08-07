package httpapi

import (
	"context"
	"fmt"
	"net/http"
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

func (rl *RateLimiter) Middleware(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if rl == nil {
			handler.ServeHTTP(w, r)
			return
		}
		key := clientIP(r) + ":" + r.URL.Path
		ok, _ := rl.Allow(r.Context(), key)
		if !ok {
			writeError(w, http.StatusTooManyRequests, "rate_limited", "too many requests")
			return
		}
		handler.ServeHTTP(w, r)
	})
}
