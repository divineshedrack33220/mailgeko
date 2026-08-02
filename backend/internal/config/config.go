package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Env     string
	Port    string
	BaseURL string

	TiDBDSN     string
	PostgresDSN string
	RedisAddr   string

	ResendAPIKeys  []string
	ResendEndpoint string

	JWTSecret string

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
		Env:                 getEnv("APP_ENV", "development"),
		Port:                getEnv("PORT", "8080"),
		BaseURL:             getEnv("BASE_URL", "http://localhost:8080"),
		TiDBDSN:             getEnv("TIDB_DSN", ""),
		PostgresDSN:         getEnv("POSTGRES_DSN", ""),
		RedisAddr:           getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:           getEnv("JWT_SECRET", ""),
		ResendAPIKeys:       splitCSV(os.Getenv("RESEND_API_KEYS")),
		ResendEndpoint:      getEnv("RESEND_API_ENDPOINT", "https://api.resend.com/emails"),
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

	if cfg.TiDBDSN == "" {
		return nil, fmt.Errorf("config: TIDB_DSN is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config: JWT_SECRET is required")
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
