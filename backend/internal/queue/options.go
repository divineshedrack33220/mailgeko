package queue

import (
	"crypto/tls"
	"net/url"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

// RedisOptions carries connection settings for a Redis instance. It is derived
// from a single REDIS_ADDR value that may be either a bare "host:port" (local
// dev, no auth/TLS) or a full redis:// or rediss:// URL (cloud, e.g. Upstash).
type RedisOptions struct {
	Addr     string
	Username string
	Password string
	TLS      bool
}

// ParseRedisAddr interprets the REDIS_ADDR value.
func ParseRedisAddr(addr string) RedisOptions {
	u, err := url.Parse(addr)
	if err == nil && (u.Scheme == "redis" || u.Scheme == "rediss") {
		o := RedisOptions{
			Addr:     u.Host,
			Username: u.User.Username(),
			TLS:      u.Scheme == "rediss",
		}
		if password, ok := u.User.Password(); ok {
			o.Password = password
		}
		return o
	}
	return RedisOptions{Addr: addr}
}

// Asynq converts the options to the asynq client/server options.
func (o RedisOptions) Asynq() asynq.RedisClientOpt {
	opt := asynq.RedisClientOpt{Addr: o.Addr, Username: o.Username, Password: o.Password}
	if o.TLS {
		opt.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	return opt
}

// GoRedis converts the options to the go-redis client options.
func (o RedisOptions) GoRedis() *redis.Options {
	opt := &redis.Options{Addr: o.Addr, Username: o.Username, Password: o.Password}
	if o.TLS {
		opt.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	return opt
}
