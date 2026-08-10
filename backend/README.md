# Mailgeko Backend

Go API + worker for Mailgeko. Go-native auth (Argon2id + purpose-scoped JWT),
MySQL/TiDB for transactional data, Postgres for analytics/pgvector, Redis for
cache/rate-limit/asynq, and a Resend-compatible client for sending email.

## Services

| Service  | Role                                                            |
| -------- | --------------------------------------------------------------- |
| MySQL/TiDB | Main transactional store (OLTP), auto-migrated at API boot     |
| Postgres | pgvector + analytics (opens, clicks, segments, embeddings)      |
| Redis    | Cache, rate limiting, asynq task queues, session blacklist      |
| Resend   | Transactional email with rotating API keys                      |
| asynq    | Background jobs (campaign sends, CSV import, event record, automation runs) |

## Layout

```
cmd/api        HTTP API server + scheduler (campaigns + automation runs)
cmd/worker     asynq worker (campaign engine, automation steps, imports)
internal/config    env-driven configuration
internal/database  connections + embedded SQL migrations (0001–0019)
internal/auth      argon2id, JWT, TOTP, recovery codes
internal/httpapi   REST handlers, middleware, webhooks, tracking
internal/engine    campaign rendering/sending, automation step execution
internal/scheduler release loop for due campaigns and due automation runs
internal/queue     asynq client + worker server (task types)
internal/sender    Resend-compatible client
internal/store     SQL queries over MySQL/TiDB
internal/analytics report queries over Postgres email_events
internal/vector    pgvector queries
internal/track     signed link generation/verification
internal/svix      webhook signature verification
internal/embed     embedding provider (openai | static)
internal/billing   Stripe + local gateway
internal/oauth     Google / GitHub sign-in
internal/cloudinary image uploads
```

## Running

```sh
cp ../.env.example ../.env   # fill in TIDB_DSN, POSTGRES_DSN, REDIS_ADDR, JWT_SECRET, RESEND_API_KEYS
go run ./cmd/api             # API on :8080 (applies migrations at boot)
go run ./cmd/worker          # asynq worker
```

Migrations are **embedded** in `internal/database/migrations` and auto-apply
when the API boots — a deploy needs no manual SQL. The frontend proxies
`/api`, `/webhooks`, `/track` and `/ping` to `:8080` (see `../next.config.ts`).

## Configuration

See `../.env.example`. The API refuses to boot without `TIDB_DSN`, `JWT_SECRET`,
and `RESEND_API_KEYS`. `POSTGRES_DSN` is optional: when set it enables the
analytics API, event enrichment and vector search; the worker records Postgres
events only when it is present. `REDIS_ADDR` defaults to a Redis bundled inside
the container image; set it to an external server to use a managed one.

## API

Everything is under `/api/v1` unless noted. Interactive routes take
`Authorization: Bearer <session JWT>`; machine-to-machine routes accept
`X-API-Key: mgk_…`.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET    | `/healthz`, `/ping` | Liveness probes |
| POST   | `/auth/register`, `/auth/login`, `/auth/logout` | Account lifecycle |
| POST   | `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` | Email flows |
| POST   | `/auth/2fa/verify`, `/auth/2fa/setup`, `/auth/2fa/enable`, `/auth/2fa/disable`, `/auth/2fa/recovery-codes` | TOTP 2FA |
| GET    | `/me`, `/auth/sessions`, `/workspace`, `/workspaces`, `/workspace/switch` | Profile & workspaces |
| GET/POST/PATCH/DELETE | `/contacts`, `/contacts/{id}` | Contact CRUD |
| POST   | `/contacts/import`, `/contacts/{id}/send`, `/contacts/embed-all`, `/contacts/{id}/embed` | Contact actions |
| GET    | `/contacts/search?q=&k=`, `/contacts/{id}/similar?k=` | pgvector search (503 when disabled) |
| GET/POST | `/lists`, `/segments`, `/templates` | Organization resources |
| GET/POST/PATCH/DELETE | `/campaigns`, `/campaigns/{id}` | Campaign CRUD |
| POST   | `/campaigns/{id}/send`, `/campaigns/{id}/send-test`, `/campaigns/{id}/cancel` | Campaign actions |
| GET    | `/campaigns/{id}/recipients` | Per-recipient status |
| GET/POST/PATCH/DELETE | `/automations`, `/automations/{id}` | Automation CRUD |
| GET    | `/automations/{id}/runs` | Per-contact run progress + failure reasons |
| POST   | `/automations/{id}/run` | Run now against all contacts |
| POST   | `/automations/{id}/restart-failed` | Re-enroll only failed contacts |
| POST   | `/automations/{id}/duplicate` | Clone an automation |
| GET    | `/analytics/overview`, `/analytics/series`, `/analytics/links`, `/analytics/devices`, `/analytics/countries`, `/analytics/heatmap`, `/analytics/campaigns/{id}` | Reports (`?range=7d|30d|90d|12m`) |
| GET/POST | `/api-keys` | Scoped API keys (SHA-256 hashed) |
| GET/PUT | `/notifications/prefs`; GET `/notifications`; POST `/notifications/read-all`, `/notifications/{id}/read` | In-app notifications |
| GET/PUT | `/workspace/smtp`; POST `/workspace/smtp/test` | BYO-SMTP |
| POST   | `/ai/subject`, `/ai/campaign`, `/ai/chat`; GET/DELETE `/ai/history` | AI studio |
| GET    | `/billing/plans`, `/billing`; POST `/billing/checkout`, `/billing/portal` | Billing |
| POST   | `/webhooks/stripe`, `/webhooks/resend` | Provider webhooks (signed) |
| GET    | `/track/open`, `/track/click`, `/track/unsubscribe` | Signed tracking links (no auth) |

## Automations

Automations execute as a per-contact state machine in `automation_runs` (one
row per automation+contact). The scheduler claims due runs and enqueues
`automation:run` tasks; the worker runs one step at a time
(send-email, delay, condition, add-tag, remove-tag, unsubscribe, webhook) and
advances the run. A step that fails 10 times marks the run `failed` with the
reason persisted and an in-app notification sent — no silent failures.
`restart-failed` re-enrolls only failed contacts, resetting each run to the
start of the flow.

## Development

```sh
go build ./... && go vet ./... && go test ./...
```

Opt-in MySQL integration check (runs in CI against a MySQL 8 service
container): set `TEST_MYSQL_DSN` and run
`go test -count=1 -run TestMySQLAutomationRunJoin -v ./internal/store/`.
The store layer is otherwise unit-tested with `sqlmock`.
