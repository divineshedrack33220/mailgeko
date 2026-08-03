package queue

import "testing"

func TestParseRedisAddr(t *testing.T) {
	t.Run("bare host:port keeps local dev behavior", func(t *testing.T) {
		o := ParseRedisAddr("127.0.0.1:6379")
		if o.Addr != "127.0.0.1:6379" || o.Username != "" || o.Password != "" || o.TLS {
			t.Fatalf("unexpected options: %+v", o)
		}
	})

	t.Run("rediss URL enables TLS and extracts auth", func(t *testing.T) {
		o := ParseRedisAddr("rediss://default:supersecret@casual-skunk-36119.upstash.io:6379")
		if o.Addr != "casual-skunk-36119.upstash.io:6379" {
			t.Fatalf("addr = %q", o.Addr)
		}
		if o.Username != "default" || o.Password != "supersecret" {
			t.Fatalf("auth = %q/%q", o.Username, o.Password)
		}
		if !o.TLS {
			t.Fatal("expected TLS for rediss")
		}
		if o.Asynq().TLSConfig == nil || o.GoRedis().TLSConfig == nil {
			t.Fatal("expected TLSConfig set on both clients")
		}
		if o.Asynq().Password != "supersecret" || o.GoRedis().Password != "supersecret" {
			t.Fatal("expected password propagated to clients")
		}
	})

	t.Run("redis URL without password", func(t *testing.T) {
		o := ParseRedisAddr("redis://localhost:6379")
		if o.Addr != "localhost:6379" || o.Password != "" || o.TLS {
			t.Fatalf("unexpected options: %+v", o)
		}
	})

	t.Run("rediss URL without user", func(t *testing.T) {
		o := ParseRedisAddr("rediss://host.upstash.io:6379")
		if o.Addr != "host.upstash.io:6379" || o.Username != "" || !o.TLS {
			t.Fatalf("unexpected options: %+v", o)
		}
	})
}
