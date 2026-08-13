package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Env     string
	Port    string
	BaseURL string

	// TrustedProxyCIDRs lists CIDRs whose forwarded-identity headers
	// (X-Forwarded-For, X-Real-IP, X-Mg-Client-IP) are honoured. In the
	// single-container deployment the Next.js rewrites reach the API from
	// loopback, so the default is 127.0.0.1/32,::1/128. When the API sits
	// directly behind a dedicated load balancer, add its CIDR instead.
	TrustedProxyCIDRs []string

	// AutoMigrate applies pending schema migrations at startup. Production
	// operators with multiple API replicas may prefer to run migrations once
	// via a separate job and set AUTO_MIGRATE=false.
	AutoMigrate bool

	// AllowedOrigins is the CORS allowlist. Requests whose Origin is not
	// listed get no Access-Control-Allow-Origin header and are blocked by the
	// browser. When ALLOWED_ORIGINS is unset it falls back to the BASE_URL
	// origin, plus the common localhost origins in development.
	AllowedOrigins []string

	TiDBDSN     string
	PostgresDSN string
	RedisAddr   string

	ResendAPIKeys  []string
	ResendEndpoint string

	// ResendWebhookSecret is the signing secret (whsec_...) used to verify
	// webhook deliveries. Empty disables webhook processing.
	ResendWebhookSecret string

	JWTSecret string

	// TrackingSecret signs email tracking links. Falls back to JWTSecret.
	TrackingSecret string

	// SecretKey encrypts secrets stored at rest (e.g. per-workspace SMTP
	// passwords). When unset, the BYO-SMTP feature is disabled.
	SecretKey string

	// DefaultFromName/DefaultFromEmail is the from address used when no
	// campaign or workspace sender is configured.
	DefaultFromName  string
	DefaultFromEmail string

	// AllowedFromDomains is the comma-separated list of sender domains that
	// are verified with the email provider. Outgoing mail falls back to the
	// default sender when a configured campaign/workspace sender uses any
	// other domain (e.g. a user's personal @gmail.com), which the provider
	// would otherwise reject.
	AllowedFromDomains []string

	// Embeddings / vector search.
	OpenAIKey     string
	EmbedModel    string
	EmbedBaseURL  string
	EmbedDims     int
	EmbedProvider string // "openai" (default) or "static" for local dev/testing

	// AI copywriting (subject-line generation).
	AIModel    string
	AIBaseURL  string

	// Billing / Stripe.
	StripeKey           string
	StripeWebhookSecret string
	StripePrices        map[string]string
	BillingProvider     string // "local" (default, no key) or "stripe"

	// Cloudinary (avatars, logos, template images).
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string

	// OAuth (Google / GitHub sign-in).
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
}

func Load() (*Config, error) {
	dims, _ := strconv.Atoi(getEnv("EMBED_DIMENSIONS", "1536"))
	cfg := &Config{
		Env:               getEnv("APP_ENV", "development"),
		Port:              getEnv("PORT", "8080"),
		BaseURL:           getEnv("BASE_URL", "http://localhost:8080"),
		TrustedProxyCIDRs: defaultTrustedProxies(os.Getenv("TRUSTED_PROXY_IPS")),
		AutoMigrate:       getEnv("AUTO_MIGRATE", "true") != "false",
		TiDBDSN:           getEnv("TIDB_DSN", ""),
		PostgresDSN:         getEnv("POSTGRES_DSN", ""),
		RedisAddr:           getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:           getEnv("JWT_SECRET", ""),
		TrackingSecret:      getEnv("TRACKING_SECRET", getEnv("JWT_SECRET", "")),
		SecretKey:           os.Getenv("MAILGEKO_SECRET_KEY"),
		DefaultFromName:     getEnv("DEFAULT_FROM_NAME", "Mailgeko"),
		DefaultFromEmail:    getEnv("DEFAULT_FROM_EMAIL", "mailgeko@clawmark.online"),
		AllowedFromDomains:  splitCSV(getEnv("ALLOWED_FROM_DOMAINS", "clawmark.online")),
		ResendAPIKeys:       splitCSV(os.Getenv("RESEND_API_KEYS")),
		ResendEndpoint:      getEnv("RESEND_API_ENDPOINT", "https://api.resend.com/emails"),
		ResendWebhookSecret: getEnv("RESEND_WEBHOOK_SECRET", ""),
		OpenAIKey:           os.Getenv("OPENAI_API_KEY"),
		EmbedModel:          getEnv("EMBED_MODEL", "text-embedding-3-small"),
		EmbedBaseURL:        getEnv("EMBED_BASE_URL", "https://api.openai.com/v1"),
		EmbedDims:           dims,
		EmbedProvider:       getEnv("EMBED_PROVIDER", "openai"),
		AIModel:             getEnv("AI_MODEL", "gpt-4o-mini"),
		AIBaseURL:           getEnv("AI_BASE_URL", "https://api.openai.com/v1"),
		StripeKey:           os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", getEnv("JWT_SECRET", "")),
		StripePrices: map[string]string{
			"starter": getEnv("STRIPE_PRICE_STARTER", ""),
			"growth":  getEnv("STRIPE_PRICE_GROWTH", ""),
			"scale":   getEnv("STRIPE_PRICE_SCALE", ""),
		},
		BillingProvider: getEnv("BILLING_PROVIDER", ""),

		CloudinaryCloudName: os.Getenv("CLOUDINARY_CLOUD_NAME"),
		CloudinaryAPIKey:    os.Getenv("CLOUDINARY_API_KEY"),
		CloudinaryAPISecret: os.Getenv("CLOUDINARY_API_SECRET"),

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
	}

	cfg.AllowedOrigins = loadAllowedOrigins(cfg.BaseURL, cfg.Env)

	if cfg.TiDBDSN == "" {
		return nil, fmt.Errorf("config: TIDB_DSN is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config: JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("config: JWT_SECRET must be at least 32 characters for security")
	}
	if len(cfg.ResendAPIKeys) == 0 {
		return nil, fmt.Errorf("config: RESEND_API_KEYS is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// defaultTrustedProxies returns the trusted proxy CIDRs. An explicit
// TRUSTED_PROXY_IPS value (comma-separated) wins; otherwise loopback is
// trusted, which covers the Next.js -> Go API rewrites on the same host.
func defaultTrustedProxies(explicit string) []string {
	if cidrs := splitCSV(explicit); len(cidrs) > 0 {
		return cidrs
	}
	return []string{"127.0.0.1/32", "::1/128"}
}

func splitCSV(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// loadAllowedOrigins returns the CORS allowlist. An explicit ALLOWED_ORIGINS
// env var (comma-separated) wins; otherwise the BASE_URL origin is used, with
// the common localhost origins added in development.
func loadAllowedOrigins(baseURL, env string) []string {
	if explicit := splitCSV(os.Getenv("ALLOWED_ORIGINS")); len(explicit) > 0 {
		return explicit
	}
	allowed := make([]string, 0, 5)
	if origin, err := originOf(baseURL); err == nil {
		allowed = append(allowed, origin)
	}
	if env != "production" {
		allowed = append(allowed,
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:8080",
			"http://127.0.0.1:8080",
		)
	}
	return allowed
}

// originOf reduces a URL to its scheme://host[:port] origin.
func originOf(rawurl string) (string, error) {
	u, err := url.Parse(rawurl)
	if err != nil {
		return "", err
	}
	if u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid base url %q", rawurl)
	}
	return u.Scheme + "://" + u.Host, nil
}
