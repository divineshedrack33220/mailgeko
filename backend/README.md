# Mailgeko Backend

Go API + worker for Mailgeko. Go-native auth (argon2id + JWT), TiDB for
transactions, Postgres for analytics/pgvector, Redis for cache/rate-limit/asynq,
Resend for sending email.

## Services

| Service        | Role                                                              |
| -------------- | ----------------------------------------------------------------- |
| TiDB           | Main transactional store (OLTP)                                   |
| Postgres       | pgvector + analytics (opens, clicks, segments)                    |
| Redis          | Cache, rate limiting, asynq task queues                           |
| Resend         | Transactional email with rotating API keys                        |
| asynq          | Background job queue (campaign sends, CSV import, webhooks)       |

## Layout

```
cmd/api        HTTP API server
cmd/worker     asynq worker (campaign engine)
internal/config   env-driven config
internal/database TiDB / Postgres / Redis connections
internal/auth     argon2id password hashing + JWT
internal/httpapi  REST handlers, middleware, session blacklist
internal/queue    asynq client + worker server
internal/sender   Resend client (Phase 1)
migrations        TiDB SQL migrations
```

## Running

```sh
cp .env.example .env   # fill in TIDB_DSN, POSTGRES_DSN, REDIS_ADDR, JWT_SECRET, RESEND_API_KEYS
make run-api           # API on :8080
make run-worker        # asynq worker
```

Apply migrations before the first run:

```sh
mysql -h <tidb-host> -P 4000 -u <user> -p <database> < migrations/0001_init.sql
```

## Configuration

See `.env.example`. The API refuses to boot without `TIDB_DSN`, `JWT_SECRET`,
and `RESEND_API_KEYS`. `POSTGRES_DSN` is optional: when set it enables the
Reports/Analytics API and event enrichment; the worker records Postgres events
only when it is present.

## API

| Method | Path                    | Description                    |
| ------ | ----------------------- | ------------------------------ |
| GET    | `/healthz`              | Liveness probe                 |
| POST   | `/api/v1/auth/register` | Create account + workspace     |
| POST   | `/api/v1/auth/login`    | Sign in, returns JWT           |
| POST   | `/api/v1/auth/logout`   | Revoke token (Redis denylist)  |
| GET    | `/api/v1/me`            | Current user + workspace       |
| GET    | `/api/v1/analytics/campaigns/{id}` | Per-campaign stats + rates |
| GET    | `/api/v1/analytics/overview` | Workspace totals, rates, series |
| GET    | `/api/v1/analytics/series` | Daily/monthly opens + clicks |
| GET    | `/api/v1/analytics/links` | Top clicked links             |
| GET    | `/api/v1/analytics/devices` | Opens by device/platform    |
| GET    | `/api/v1/analytics/countries` | Opens by country           |
| GET    | `/api/v1/analytics/heatmap` | 24x7 open heatmap           |
| GET    | `/api/v1/contacts/search?q=&k=` | Semantic contact search (pgvector) |
| GET    | `/api/v1/contacts/{id}/similar?k=` | Contacts most similar to one contact |
| POST   | `/api/v1/contacts/embed-all` | Backfill embeddings for all workspace contacts |
| POST   | `/api/v1/contacts/{id}/embed` | (Re)embed a single contact   |
| GET    | `/api/v1/billing/plans` | Plan catalog (starter/growth/scale) |
| GET    | `/api/v1/billing` | Current plan, limits, and usage |
| POST   | `/api/v1/billing/checkout` | Start subscription checkout (`{plan}`) |
| POST   | `/api/v1/billing/portal` | Open Stripe billing portal |
| POST   | `/webhooks/stripe` | Stripe webhook (checkout/subscription events) |

Phase 1 adds contacts, lists, segments, templates, campaigns, automations,
webhooks, and CSV import. Phase 2 adds the analytics API above (powered by the
Postgres `email_events` table) with device/country enrichment on tracking
pixels, pgvector semantic search, and billing. Analytics endpoints take
`?range=7d|30d|90d|12m`.

Vector search embeds each contact's profile (name, company, position, country,
city, industry, plan, tags) into Postgres `contact_embeddings` on create/update
and powers `search`/`similar`. It requires `POSTGRES_DSN` plus `EMBED_PROVIDER`
and `OPENAI_API_KEY` (or `EMBED_PROVIDER=static` for offline smoke tests);
search returns 503 when embedding is disabled.

Billing starts every workspace on `starter` (2,000 contacts / 10,000 emails per
month). Contact create/import and campaign send check the plan limits and return
`402` with a `contact_limit`/`email_limit` error when exceeded. With
`BILLING_PROVIDER=stripe` a checkout redirects to Stripe and a webhook updates
the workspace plan; `BILLING_PROVIDER=local` completes checkouts immediately for
offline testing.

## Development

```sh
make vet test build
```

## Roadmap

- **Phase 0** (current): scaffolding, DB connections, auth, queue wiring.
- **Phase 1**: domain REST API, Resend sender with key rotation, campaign engine.
- **Phase 2**: CSV import, webhooks, analytics, pgvector search, billing.
