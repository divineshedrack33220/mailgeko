package httpapi

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type SessionStore struct {
	rdb *redis.Client
}

func NewSessionStore(rdb *redis.Client) *SessionStore {
	return &SessionStore{rdb: rdb}
}

func (s *SessionStore) Blacklist(ctx context.Context, tokenID string, ttl time.Duration) error {
	return s.rdb.Set(ctx, "denylist:"+tokenID, "1", ttl).Err()
}

func (s *SessionStore) IsBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	n, err := s.rdb.Exists(ctx, "denylist:"+tokenID).Result()
	return n > 0, err
}
