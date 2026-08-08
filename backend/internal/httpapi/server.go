package httpapi

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/ai"
	"github.com/divineshedrack33220/mailgeko/backend/internal/auth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/cloudinary"
	"github.com/divineshedrack33220/mailgeko/backend/internal/engine"
	"github.com/divineshedrack33220/mailgeko/backend/internal/oauth"
	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

const claimsKey contextKey = "claims"

type contextKey string

type Server struct {
	cfg       Config
	db        *store.Store
	analytics AnalyticsStore
	tokens    TokenIssuer
	session   *SessionStore
	queue     CampaignEnqueuer
	engine    *engine.Engine
	searcher  ContactSearcher
	biller    Biller
	rateLimit *RateLimiter
	ai        *ai.Client
	uploads   *cloudinary.Client
	oauth     *oauth.Manager
	trackingSecret string
}

type Config struct {
	Env       string
	JWTSecret string
	TokenTTL  time.Duration
	HTTPAddr  string
	BaseURL   string

	// AllowedOrigins is the CORS allowlist. Origins not listed receive no
	// Access-Control-Allow-Origin header. Empty disables cross-origin access.
	AllowedOrigins []string

	// TrackingSecret signs email tracking links (opens/clicks/unsubscribes).
	TrackingSecret string

	// ResendWebhookSecret verifies Resend webhook deliveries. Empty disables
	// webhook processing.
	ResendWebhookSecret string

	// AI subject-line generation (optional; falls back to built-in templates).
	OpenAIKey     string
	OpenAIModel   string
	OpenAIBaseURL string

	// Cloudinary image uploads (optional).
	Cloudinary *cloudinary.Client

	// Google/GitHub OAuth sign-in (optional).
	OAuth *oauth.Manager
}

type TokenIssuer interface {
	Issue(userID, email, workspaceID, role string) (string, error)
	IssueWithTTL(userID, email, workspaceID, role string, ttl time.Duration) (string, error)
	IssuePendingTwoFactor(userID, email string) (string, error)
	IssuePendingTwoFactorWithTTL(userID, email string, ttl time.Duration) (string, error)
	IssueEmailVerification(userID, email string) (string, error)
	IssuePasswordReset(userID, email string) (string, error)
	Parse(tokenString string) (*auth.Claims, error)
}

type ClaimsReader interface {
	GetUserID() string
	GetEmail() string
	GetWorkspaceID() string
	GetRole() string
	GetTokenID() string
}

type CampaignEnqueuer interface {
	EnqueueCampaignSend(ctx context.Context, campaignID string) error
	EnqueueRecipientSend(ctx context.Context, campaignID, contactID string) error
	EnqueueRecordEvent(ctx context.Context, p queueRecordEventPayload) error
	EnqueueImportCSV(ctx context.Context, p queueImportCSVPayload) error
	EnqueueEmbedContact(ctx context.Context, p queueEmbedContactPayload) error
	EnqueueEmbedWorkspace(ctx context.Context, p queueEmbedWorkspacePayload) error
}

func New(cfg Config, db *store.Store, analytics AnalyticsStore, tokens TokenIssuer, session *SessionStore, queue CampaignEnqueuer, eng *engine.Engine, searcher ContactSearcher, biller Biller, rateLimit *RateLimiter) *Server {
	return &Server{
		cfg:            cfg,
		db:             db,
		analytics:      analytics,
		tokens:         tokens,
		session:        session,
		queue:          queue,
		engine:         eng,
		searcher:       searcher,
		biller:         biller,
		rateLimit:      rateLimit,
		ai:             ai.NewClient(cfg.OpenAIBaseURL, cfg.OpenAIKey, cfg.OpenAIModel),
		uploads:        cfg.Cloudinary,
		oauth:          cfg.OAuth,
		trackingSecret: cfg.TrackingSecret,
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /ping", s.handlePing)

	mux.HandleFunc("POST /api/v1/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/v1/auth/forgot-password", s.handleForgotPassword)
	mux.HandleFunc("POST /api/v1/auth/reset-password", s.handleResetPassword)
	mux.HandleFunc("POST /api/v1/auth/verify-email", s.handleVerifyEmail)
	mux.Handle("POST /api/v1/auth/resend-verification", s.withAuth(http.HandlerFunc(s.handleResendVerification)))
	mux.HandleFunc("GET /api/v1/auth/oauth/google", s.handleOAuthStart(oauth.Google))
	mux.HandleFunc("GET /api/v1/auth/oauth/github", s.handleOAuthStart(oauth.GitHub))
	mux.HandleFunc("GET /api/v1/auth/oauth/google/callback", s.handleOAuthCallback(oauth.Google))
	mux.HandleFunc("GET /api/v1/auth/oauth/github/callback", s.handleOAuthCallback(oauth.GitHub))
	mux.Handle("POST /api/v1/auth/logout", s.withAuth(http.HandlerFunc(s.handleLogout)))
	mux.Handle("GET /api/v1/me", s.withAuth(http.HandlerFunc(s.handleMe)))
	mux.Handle("GET /api/v1/auth/sessions", s.withAuth(http.HandlerFunc(s.handleListSessions)))
	mux.Handle("DELETE /api/v1/auth/sessions", s.withAuth(http.HandlerFunc(s.handleRevokeAllSessions)))
	mux.Handle("DELETE /api/v1/auth/sessions/{tokenID}", s.withAuth(http.HandlerFunc(s.handleRevokeSession)))
	mux.Handle("POST /api/v1/auth/2fa/verify", http.HandlerFunc(s.handleVerifyTwoFactor))
	mux.Handle("POST /api/v1/auth/2fa/setup", s.withAuth(http.HandlerFunc(s.handle2FASetup)))
	mux.Handle("POST /api/v1/auth/2fa/enable", s.withAuth(http.HandlerFunc(s.handle2FAEnable)))
	mux.Handle("POST /api/v1/auth/2fa/disable", s.withAuth(http.HandlerFunc(s.handle2FADisable)))
	mux.Handle("POST /api/v1/auth/2fa/recovery-codes", s.withAuth(http.HandlerFunc(s.handle2FARegenerateCodes)))

	// Domain API (all scoped to the caller's workspace).
	mux.Handle("GET /api/v1/contacts", s.withAuth(http.HandlerFunc(s.handleListContacts)))
	mux.Handle("POST /api/v1/contacts", s.withAuth(http.HandlerFunc(s.handleCreateContact)))
	mux.Handle("POST /api/v1/contacts/import", s.withAuth(http.HandlerFunc(s.handleImportContacts)))
	mux.Handle("POST /api/v1/contacts/embed-all", s.withAuth(http.HandlerFunc(s.handleEmbedAllContacts)))
	mux.Handle("GET /api/v1/contacts/search", s.withAuth(http.HandlerFunc(s.handleSearchContacts)))
	mux.Handle("POST /api/v1/contacts/bulk/tags", s.withAuth(http.HandlerFunc(s.handleBulkTagContacts)))
	mux.Handle("GET /api/v1/tags", s.withAuth(http.HandlerFunc(s.handleListTags)))
	mux.Handle("GET /api/v1/contacts/{id}", s.withAuth(http.HandlerFunc(s.handleGetContact)))
	mux.Handle("GET /api/v1/contacts/{id}/similar", s.withAuth(http.HandlerFunc(s.handleSimilarContacts)))
	mux.Handle("PATCH /api/v1/contacts/{id}", s.withAuth(http.HandlerFunc(s.handleUpdateContact)))
	mux.Handle("DELETE /api/v1/contacts/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteContact)))
	mux.Handle("POST /api/v1/contacts/{id}/send", s.withAuth(http.HandlerFunc(s.handleSendOneToOne)))
	mux.Handle("POST /api/v1/contacts/{id}/embed", s.withAuth(http.HandlerFunc(s.handleEmbedContact)))

	mux.Handle("GET /api/v1/lists", s.withAuth(http.HandlerFunc(s.handleListLists)))
	mux.Handle("POST /api/v1/lists", s.withAuth(http.HandlerFunc(s.handleCreateList)))
	mux.Handle("GET /api/v1/lists/{id}", s.withAuth(http.HandlerFunc(s.handleGetList)))
	mux.Handle("PATCH /api/v1/lists/{id}", s.withAuth(http.HandlerFunc(s.handleUpdateList)))
	mux.Handle("DELETE /api/v1/lists/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteList)))
	mux.Handle("POST /api/v1/lists/{id}/contacts", s.withAuth(http.HandlerFunc(s.handleAddContactsToList)))
	mux.Handle("DELETE /api/v1/lists/{id}/contacts/{contactId}", s.withAuth(http.HandlerFunc(s.handleRemoveContactFromList)))

	mux.Handle("GET /api/v1/segments", s.withAuth(http.HandlerFunc(s.handleListSegments)))
	mux.Handle("POST /api/v1/segments", s.withAuth(http.HandlerFunc(s.handleCreateSegment)))
	mux.Handle("GET /api/v1/segments/{id}", s.withAuth(http.HandlerFunc(s.handleGetSegment)))
	mux.Handle("PATCH /api/v1/segments/{id}", s.withAuth(http.HandlerFunc(s.handleUpdateSegment)))
	mux.Handle("DELETE /api/v1/segments/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteSegment)))

	mux.Handle("GET /api/v1/templates", s.withAuth(http.HandlerFunc(s.handleListTemplates)))
	mux.Handle("POST /api/v1/templates", s.withAuth(http.HandlerFunc(s.handleCreateTemplate)))
	mux.Handle("POST /api/v1/templates/generate", s.withAuth(http.HandlerFunc(s.handleGenerateTemplate)))
	mux.Handle("GET /api/v1/templates/{id}", s.withAuth(http.HandlerFunc(s.handleGetTemplate)))
	mux.Handle("PATCH /api/v1/templates/{id}", s.withAuth(http.HandlerFunc(s.handleUpdateTemplate)))
	mux.Handle("DELETE /api/v1/templates/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteTemplate)))
	mux.Handle("POST /api/v1/templates/{id}/send-test", s.withAuth(http.HandlerFunc(s.handleSendTestTemplate)))

	mux.Handle("GET /api/v1/campaigns", s.withAuth(http.HandlerFunc(s.handleListCampaigns)))
	mux.Handle("POST /api/v1/campaigns", s.withAuth(http.HandlerFunc(s.handleCreateCampaign)))
	mux.Handle("GET /api/v1/campaigns/{id}", s.withAuth(http.HandlerFunc(s.handleGetCampaign)))
	mux.Handle("PATCH /api/v1/campaigns/{id}", s.withAuth(http.HandlerFunc(s.handleUpdateCampaign)))
	mux.Handle("DELETE /api/v1/campaigns/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteCampaign)))
	mux.Handle("POST /api/v1/campaigns/{id}/send", s.withAuth(http.HandlerFunc(s.handleSendCampaign)))
	mux.Handle("POST /api/v1/campaigns/{id}/send-test", s.withAuth(http.HandlerFunc(s.handleSendTestCampaign)))
	mux.Handle("POST /api/v1/campaigns/{id}/cancel", s.withAuth(http.HandlerFunc(s.handleCancelCampaign)))

	mux.Handle("GET /api/v1/automations", s.withAuth(http.HandlerFunc(s.handleListAutomations)))
	mux.Handle("POST /api/v1/automations", s.withAuth(http.HandlerFunc(s.handleCreateAutomation)))
	mux.Handle("GET /api/v1/automations/{id}", s.withAuth(http.HandlerFunc(s.handleGetAutomation)))
	mux.Handle("PATCH /api/v1/automations/{id}", s.withAuth(http.HandlerFunc(s.handleUpdateAutomation)))
	mux.Handle("DELETE /api/v1/automations/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteAutomation)))
	mux.Handle("POST /api/v1/automations/{id}/duplicate", s.withAuth(http.HandlerFunc(s.handleDuplicateAutomation)))

	// Analytics.
	mux.Handle("GET /api/v1/analytics/campaigns/{id}", s.withAuth(http.HandlerFunc(s.handleCampaignAnalytics)))
	mux.Handle("GET /api/v1/analytics/overview", s.withAuth(http.HandlerFunc(s.handleAnalyticsOverview)))
	mux.Handle("GET /api/v1/analytics/series", s.withAuth(http.HandlerFunc(s.handleAnalyticsSeries)))
	mux.Handle("GET /api/v1/analytics/links", s.withAuth(http.HandlerFunc(s.handleAnalyticsLinks)))
	mux.Handle("GET /api/v1/analytics/devices", s.withAuth(http.HandlerFunc(s.handleAnalyticsDevices)))
	mux.Handle("GET /api/v1/analytics/countries", s.withAuth(http.HandlerFunc(s.handleAnalyticsCountries)))
	mux.Handle("GET /api/v1/analytics/heatmap", s.withAuth(http.HandlerFunc(s.handleAnalyticsHeatmap)))

	// Tracking + webhooks (no auth; signed/validated by query or signature).
	mux.HandleFunc("GET /track/open", s.handleTrackOpen)
	mux.HandleFunc("GET /track/click", s.handleTrackClick)
	mux.HandleFunc("GET /track/unsubscribe", s.handleTrackUnsubscribe)

	mux.HandleFunc("POST /webhooks/stripe", s.handleStripeWebhook)
	mux.Handle("GET /api/v1/billing/plans", s.withAuth(http.HandlerFunc(s.handleBillingPlans)))
	mux.Handle("GET /api/v1/billing", s.withAuth(http.HandlerFunc(s.handleBillingCurrent)))
	mux.Handle("POST /api/v1/billing/checkout", s.withAuth(http.HandlerFunc(s.handleBillingCheckout)))
	mux.Handle("POST /api/v1/billing/portal", s.withAuth(http.HandlerFunc(s.handleBillingPortal)))
	mux.HandleFunc("POST /webhooks/resend", s.handleResendWebhook)

	mux.Handle("PATCH /api/v1/me", s.withAuth(http.HandlerFunc(s.handleUpdateProfile)))
	mux.Handle("POST /api/v1/me/avatar", s.withAuth(http.HandlerFunc(s.handleUploadAvatar)))
	mux.Handle("POST /api/v1/auth/password", s.withAuth(http.HandlerFunc(s.handleChangePassword)))

	mux.Handle("POST /api/v1/workspace/logo", s.withAuth(http.HandlerFunc(s.handleUploadLogo)))

	mux.Handle("GET /api/v1/workspace/members", s.withAuth(http.HandlerFunc(s.handleListWorkspaceMembers)))
	mux.Handle("POST /api/v1/workspace/members/invite", s.withAuth(http.HandlerFunc(s.handleInviteWorkspaceMember)))
	mux.Handle("POST /api/v1/invitations/accept", s.withAuth(http.HandlerFunc(s.handleAcceptInvitation)))
	mux.Handle("PATCH /api/v1/workspace/members/{id}", s.withAuth(http.HandlerFunc(s.handleUpdateWorkspaceMember)))
	mux.Handle("POST /api/v1/workspace/members/{id}/resend", s.withAuth(http.HandlerFunc(s.handleResendInvitation)))
	mux.Handle("POST /api/v1/workspace/members/{id}/remind", s.withAuth(http.HandlerFunc(s.handleSendMemberReminder)))
	mux.Handle("DELETE /api/v1/workspace/members/{id}", s.withAuth(http.HandlerFunc(s.handleRemoveWorkspaceMember)))

	mux.Handle("GET /api/v1/api-keys", s.withAuth(http.HandlerFunc(s.handleListAPIKeys)))
	mux.Handle("POST /api/v1/api-keys", s.withAuth(http.HandlerFunc(s.handleCreateAPIKey)))
	mux.Handle("DELETE /api/v1/api-keys/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteAPIKey)))

	mux.Handle("GET /api/v1/notifications/prefs", s.withAuth(http.HandlerFunc(s.handleGetNotificationPrefs)))
	mux.Handle("PUT /api/v1/notifications/prefs", s.withAuth(http.HandlerFunc(s.handleUpdateNotificationPrefs)))

	mux.Handle("GET /api/v1/notifications", s.withAuth(http.HandlerFunc(s.handleListNotifications)))
	mux.Handle("POST /api/v1/notifications/read-all", s.withAuth(http.HandlerFunc(s.handleReadAllNotifications)))
	mux.Handle("POST /api/v1/notifications/{id}/read", s.withAuth(http.HandlerFunc(s.handleMarkNotificationRead)))

	mux.Handle("GET /api/v1/workspace", s.withAuth(http.HandlerFunc(s.handleGetWorkspace)))
	mux.Handle("PATCH /api/v1/workspace", s.withAuth(http.HandlerFunc(s.handleUpdateWorkspace)))
	mux.Handle("GET /api/v1/workspace/brand-voice", s.withAuth(http.HandlerFunc(s.handleGetBrandVoice)))
	mux.Handle("PUT /api/v1/workspace/brand-voice", s.withAuth(http.HandlerFunc(s.handleUpdateBrandVoice)))

	mux.Handle("POST /api/v1/ai/subject", s.withAuth(http.HandlerFunc(s.handleGenerateSubjects)))
	mux.Handle("POST /api/v1/ai/campaign", s.withAuth(http.HandlerFunc(s.handleGenerateCampaign)))
	mux.Handle("POST /api/v1/ai/chat", s.withAuth(http.HandlerFunc(s.handleChat)))
	mux.Handle("GET /api/v1/ai/history", s.withAuth(http.HandlerFunc(s.handleListAIHistory)))
	mux.Handle("DELETE /api/v1/ai/history/{id}", s.withAuth(http.HandlerFunc(s.handleDeleteAIHistory)))

	return s.withMiddleware(mux)
}

func (s *Server) withMiddleware(next http.Handler) http.Handler {
	next = s.withLogging(next)
	if s.rateLimit != nil {
		next = s.rateLimit.Middleware(next)
	}
	next = s.withCORS(next)
	next = s.withSecurityHeaders(next)
	return next
}

// withSecurityHeaders hardens every response. It is the outermost middleware so
// even OPTIONS preflight and error responses get the headers.
func (s *Server) withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		if s.cfg.Env == "production" {
			h.Set("Strict-Transport-Security", "max-age=31536000")
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if s.originAllowed(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// originAllowed reports whether a request Origin is on the CORS allowlist.
// Comparison is case-insensitive and ignores trailing slashes.
func (s *Server) originAllowed(origin string) bool {
	origin = strings.TrimRight(origin, "/")
	for _, allowed := range s.cfg.AllowedOrigins {
		if strings.EqualFold(strings.TrimRight(allowed, "/"), origin) {
			return true
		}
	}
	return false
}

func (s *Server) withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if apiKey := apiKeyFromRequest(r); apiKey != "" {
			claims, ok := s.authenticateAPIKey(r, apiKey)
			if !ok {
				writeError(w, http.StatusUnauthorized, "unauthorized", "invalid API key")
				return
			}
			if !s.apiKeyAllowed(r, claims) {
				writeError(w, http.StatusForbidden, "forbidden", "API key lacks the required scope")
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		authHeader := r.Header.Get("Authorization")
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == "" || token == authHeader {
			writeError(w, http.StatusUnauthorized, "unauthorized", "missing bearer token")
			return
		}
		claims, err := s.tokens.Parse(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
			return
		}
		if claims.Pending {
			writeError(w, http.StatusUnauthorized, "unauthorized", "complete the second-factor step to continue")
			return
		}
		if s.session != nil {
			blacklisted, err := s.session.IsBlacklisted(r.Context(), claims.GetTokenID())
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "could not verify session")
				return
			}
			if blacklisted {
				writeError(w, http.StatusUnauthorized, "unauthorized", "session has been revoked")
				return
			}
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		s.refreshSessionActivity(ctx, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func claimsFrom(r *http.Request) ClaimsReader {
	if c, ok := r.Context().Value(claimsKey).(ClaimsReader); ok {
		return c
	}
	return nil
}

// requireMemberRole rejects the request unless the caller's current role in
// this workspace is one of allowed. The role is read fresh from the database
// so role changes and removals take effect immediately.
func (s *Server) requireMemberRole(w http.ResponseWriter, r *http.Request, allowed ...string) bool {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return false
	}
	role, err := s.db.WorkspaceMemberByUserID(r.Context(), claims.GetWorkspaceID(), claims.GetUserID())
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusForbidden, "forbidden", "you are not a member of this workspace")
		} else {
			writeError(w, http.StatusInternalServerError, "internal", "could not verify permissions")
		}
		return false
	}
	for _, a := range allowed {
		if role == a {
			return true
		}
	}
	writeError(w, http.StatusForbidden, "forbidden", "you do not have permission to do that")
	return false
}
