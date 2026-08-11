package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type SessionInfo struct {
	TokenID   string    `json:"tokenId"`
	Device    string    `json:"device"`
	Location  string    `json:"location"`
	IP        string    `json:"ip"`
	IssuedAt  time.Time `json:"issuedAt"`
	ExpiresAt time.Time `json:"expiresAt"`
	LastSeen  time.Time `json:"lastSeen"`
	Current   bool      `json:"current"`
}

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

func sessionKey(userID, tokenID string) string { return "session:" + userID + ":" + tokenID }

func (s *SessionStore) Create(ctx context.Context, userID, tokenID, device, location, ip string, ttl time.Duration) error {
	now := time.Now().UTC()
	meta := SessionInfo{
		TokenID:   tokenID,
		Device:    device,
		Location:  location,
		IP:        ip,
		IssuedAt:  now,
		ExpiresAt: now.Add(ttl),
		LastSeen:  now,
	}
	raw, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	return s.rdb.Set(ctx, sessionKey(userID, tokenID), raw, ttl).Err()
}

func (s *SessionStore) List(ctx context.Context, userID string) ([]SessionInfo, error) {
	var cursor uint64
	pattern := "session:" + userID + ":*"
	var sessions []SessionInfo
	for {
		keys, nextCursor, err := s.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, err
		}
		for _, key := range keys {
			raw, err := s.rdb.Get(ctx, key).Result()
			if err == redis.Nil {
				continue
			}
			if err != nil {
				return nil, err
			}
			var meta SessionInfo
			if err := json.Unmarshal([]byte(raw), &meta); err != nil {
				continue
			}
			sessions = append(sessions, meta)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return sessions, nil
}

func (s *SessionStore) Revoke(ctx context.Context, userID, tokenID string, ttl time.Duration) error {
	if err := s.rdb.Del(ctx, sessionKey(userID, tokenID)).Err(); err != nil {
		return err
	}
	return s.Blacklist(ctx, tokenID, ttl)
}

// RevokeAll signs out every device of a user by blacklisting each of their
// live session tokens.
func (s *SessionStore) RevokeAll(ctx context.Context, userID string, ttl time.Duration) error {
	var cursor uint64
	pattern := "session:" + userID + ":*"
	for {
		keys, nextCursor, err := s.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}
		for _, key := range keys {
			raw, err := s.rdb.Get(ctx, key).Result()
			if err != nil {
				continue
			}
			var meta SessionInfo
			if err := json.Unmarshal([]byte(raw), &meta); err != nil {
				continue
			}
			if err := s.rdb.Del(ctx, key).Err(); err != nil {
				return err
			}
			if err := s.Blacklist(ctx, meta.TokenID, ttl); err != nil {
				return err
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

func (s *SessionStore) RevokeAllExcept(ctx context.Context, userID, keepTokenID string, ttl time.Duration) error {
	var cursor uint64
	pattern := "session:" + userID + ":*"
	for {
		keys, nextCursor, err := s.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}
		for _, key := range keys {
			raw, err := s.rdb.Get(ctx, key).Result()
			if err != nil {
				continue
			}
			var meta SessionInfo
			if err := json.Unmarshal([]byte(raw), &meta); err != nil {
				continue
			}
			if meta.TokenID == keepTokenID {
				continue
			}
			if err := s.rdb.Del(ctx, key).Err(); err != nil {
				return err
			}
			if err := s.Blacklist(ctx, meta.TokenID, ttl); err != nil {
				return err
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

// Touch records activity on a session so the UI can show how recently it was
// used. It is throttled to at most one write per session per five minutes.
func (s *SessionStore) Touch(ctx context.Context, userID, tokenID string, ttl time.Duration) {
	ok, err := s.rdb.SetNX(ctx, "touch:"+userID+":"+tokenID, "1", 5*time.Minute).Result()
	if err != nil || !ok {
		return
	}
	raw, err := s.rdb.Get(ctx, sessionKey(userID, tokenID)).Result()
	if err != nil {
		return
	}
	var meta SessionInfo
	if err := json.Unmarshal([]byte(raw), &meta); err != nil {
		return
	}
	meta.LastSeen = time.Now().UTC()
	if raw, err := json.Marshal(meta); err == nil {
		_ = s.rdb.Set(ctx, sessionKey(userID, tokenID), raw, ttl).Err()
	}
}

// deviceFromUserAgent returns a friendly device label such as
// "Chrome on macOS" or "Safari on iPhone" from a user-agent string.
func deviceFromUserAgent(ua string) string {
	l := strings.ToLower(ua)
	os := "Unknown OS"
	switch {
	case strings.Contains(l, "iphone") || strings.Contains(l, "ipad"):
		os = "iOS"
	case strings.Contains(l, "windows"):
		os = "Windows"
	case strings.Contains(l, "mac os") || strings.Contains(l, "macintosh"):
		os = "macOS"
	case strings.Contains(l, "android"):
		os = "Android"
	case strings.Contains(l, "linux"):
		os = "Linux"
	}
	browser := "Browser"
	switch {
	case strings.Contains(l, "edg/"):
		browser = "Edge"
	case strings.Contains(l, "opr/") || strings.Contains(l, "opera"):
		browser = "Opera"
	case strings.Contains(l, "chrome") || strings.Contains(l, "crios"):
		browser = "Chrome"
	case strings.Contains(l, "firefox"):
		browser = "Firefox"
	case strings.Contains(l, "safari"):
		browser = "Safari"
	}
	return fmt.Sprintf("%s on %s", browser, os)
}
