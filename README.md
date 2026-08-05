# Mailgeko

**A self-hostable email marketing platform.** Build audiences, design on-brand
campaigns, automate your send pipeline, and measure every open, click and bounce
— all in one deployable unit.

Mailgeko ships the **frontend, API and async worker together in a single Docker
image**, with pluggable datastores, a Resend-compatible email provider and
optional Stripe billing. You can go from `git clone` to your first campaign in
minutes.

---

## Table of contents

1. [Highlights](#highlights)
2. [Feature matrix](#feature-matrix)
3. [Architecture](#architecture)
4. [Technology stack](#technology-stack)
5. [Data model](#data-model)
6. [Core flows](#core-flows)
7. [Security model](#security-model)
8. [HTTP API](#http-api)
9. [Repository layout](#repository-layout)
10. [Getting started](#getting-started)
11. [Environment variables](#environment-variables)
12. [Deployment](#deployment)
13. [Testing](#testing)
14. [Known limitations & roadmap](#known-limitations--roadmap)
15. [License](#license)

---

## Highlights

- **One image, three processes.** The container runs the Go API (`:8080`), the
  async worker, and the Next.js web app; Next reverse-proxies `/api`, `/webhooks`
  and `/track` traffic to the in-process API. No microservices to orchestrate.
- **Postgres-quality marketing data on MySQL.** Users, contacts, campaigns and
  billing live in TiDB/MySQL; analytics events and contact embeddings live in
  Postgres + pgvector for fast rollups and semantic search.
- **Reliable by default.** Scheduled sends are claimed atomically in the
  database, queued on Redis via [asynq](https://github.com/hibiken/asynq), and
  each recipient is processed individually so a single failure can't stall a
  campaign. Delivery events arrive over signed webhooks (Svix) or signed
  tracking links.
- **Tracked end to end.** Template rendering injects open-tracking pixels,
  click-tracked links and unsubscribe links — all signed with a server-side
  secret so they can't be forged.
- **Bring your own everything.** Resend-compatible email, OpenAI-compatible
  chat/embeddings, Stripe or a built-in local gateway, Google/GitHub OAuth, and
  Cloudinary uploads.

---

## Feature matrix

| Area | What you can do |
| --- | --- |
| **Contacts** | Add/edit/delete, custom fields, tags, import via CSV (async), search, one-click duplicate/cleanup |
| **Lists & segments** | Static lists, dynamic segments with match-any/all conditions (status, profile fields, tags, last engagement, custom fields) |
| **Templates** | Reusable MJML/HTML templates with `{{placeholder}}` variables, live preview |
| **Campaigns** | Audience from lists + segments, per-recipient rendering, open/click tracking, unsubscribe, scheduled send, per-campaign stats, duplicate |
| **Automations** | Trigger-based automation workflows (visual builder) |
| **Analytics** | Overview, time-series, link click maps, device/browser, country/city, per-recipient detail |
| **Vector search** | Optional semantic search over contacts via OpenAI embeddings + pgvector |
| **AI studio** | Subject-line and campaign-copy generation from an OpenAI-compatible API, usage history |
| **Billing** | Stripe plans (Starter/Growth/Scale), portal, webhooks, or built-in local gateway; send-volume gating |
| **Auth** | Email + password (Argon2id), email verification, password reset, TOTP two-factor, Google/GitHub OAuth, API keys with scopes |
| **Team** | Workspaces, member invitations, roles |
| **Extras** | In-app notifications, file uploads via Cloudinary, rate limiting, audit of security posture |

---

## Architecture

```
                              ┌──────────────────────────────────────────┐
                              │             MAILGEKO IMAGE               │
                              │                                          │
   Browser ── HTTPS ──► Next.js web (App Router, standalone)             │
   Client │                 │                                            │
          │                 │ rewrite: /api /webhooks /track /ping       │
          ▼                 ▼                                            │
        Next.js ──────────► Go API  (127.0.0.1:8080)                     │
        (REST/JSON)         │  • HTTP handlers                           │
                           │  • middleware chain                         │
                           │  • scheduler (cron, claims due campaigns)   │
                           │            │                                │
                           │            ▼ asynq (enqueue)                │
                           │        ┌──────────┐                         │
                           │        │  Redis   │◄──── rate limits ───────┤
                           │        └────┬─────┘   sessions              │
                           │             │ asynq (dequeue)               │
                           │             ▼                               │
                           │        Go Worker                           │
                           │  • campaign & recipient sends               │
                           │  • CSV import                               │
                           │  • event recording (opens/clicks/bounces)   │
                           │  • embeddings                               │
                           ▼             ▼                               │
        ┌─────────────────┐  ┌──────────────────────────────┐           │
        │  TiDB/MySQL     │  │  PostgreSQL + pgvector       │           │
        │  (primary)      │  │  (analytics, embeddings)     │           │
        └────────┬────────┘  └──────────────┬───────────────┘           │
                 │                          │                            │
                 ▼                          ▼                            │
        ┌─────────────────────────────────────────────┐                  │
        │ Resend (SMTP/API)  Stripe  Cloudinary  OAuth │                 │
        │                (outbound integrations)       │                 │
        └─────────────────────────────────────────────┘                  │
                              └──────────────────────────────────────────┘
```

### Runtime processes

| Process | Entrypoint | Responsibility |
| --- | --- | --- |
| **API** | `backend/cmd/api` | HTTP server: REST API, webhook ingestion (Resend/Stripe), tracking endpoints, campaign scheduler (releases due campaigns into the queue) |
| **Worker** | `backend/cmd/worker` | Consumes the asynq queue: renders + sends individual emails, records delivery events, imports CSVs, computes embeddings |
| **Web** | Next.js standalone server | UI on `:3000` (or `$PORT`); proxies `/api/*`, `/webhooks/*`, `/track/*`, `/ping` to the API |

The API applies any pending SQL migrations at startup, so deploys are
migrate-and-go.

### Datastores

| Store | Used for |
| --- | --- |
| **TiDB / MySQL** (required) | Primary store: users, workspaces, contacts, lists, segments, templates, campaigns, campaign stats & recipients, automations, billing state, API keys, notifications, AI history. Ship with MariaDB for self-hosting. |
| **Redis** (required) | asynq task queue, rate-limit windows, session token blacklist. |
| **PostgreSQL + pgvector** (required) | Email analytics events + enrichment and contact embeddings for vector search. |
| **Resend-compatible API** | Outbound transactional + campaign email. Point `RESEND_API_ENDPOINT` at any compatible server, or a mock. |
| **Stripe** (optional) | Plans, checkout, customer portal; falls back to a built-in local gateway. |
| **Cloudinary** (optional) | File/asset uploads. |

---

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui, Recharts, MJML preview |
| API | Go 1.22+, chi router, `jmoiron/sqlx`, `golang-jwt/jwt/v5`, `hibiken/asynq` |
| Databases | TiDB/MySQL (via `go-sql-driver/mysql`), PostgreSQL (pgx) + pgvector |
| Queue / cache | Redis (`go-redis/v9`), asynq tasks |
| Email | Resend-compatible REST client |
| Auth | Argon2id password hashing, JWT (purpose-scoped), TOTP 2FA (`pquerna/otp`), OAuth 2.0 |
| Payments | Stripe Go SDK + webhooks, or built-in local gateway |
| AI | OpenAI-compatible chat completions; embeddings via OpenAI or deterministic `static` provider |
| Deploy | Docker multi-stage build, docker-compose, Render blueprint |

---

## Data model

Core entities and their relationships:

```
User ──1:N── WorkspaceMembers ──N:1── Workspace ──1:N── Contacts
                                              ├──1:N── Lists
                                              ├──1:N── Segments
                                              ├──1:N── Templates
                                              ├──1:N── Campaigns ──1:N── CampaignRecipients
                                              ├──1:N── Automations
                                              ├──1:N── ApiKeys
                                              └──1:N── Invitations / Notifications
CampaignRecipients ──1:N── (Postgres) EmailEvents   (sent, opened, clicked, bounced…)
Contacts ──1:1── (Postgres) ContactEmbeddings        (pgvector)
```

Key points:

- **Multi-tenancy.** Every user belongs to a workspace; most tables carry
  `workspace_id`. Workspace members can have roles (owner/admin/member).
- **Recipients are materialized.** When a campaign starts, each recipient
  becomes a `campaign_recipients` row so per-recipient state and stats are
  queryable without scanning raw events.
- **Events are append-only.** Raw email events land in Postgres
  (`email_events`) and are rolled up into campaign stats counters.
- **Embeddings.** Contacts (and optionally whole workspaces) get vector
  embeddings in Postgres for semantic search; disabled by falling back to the
  `static` provider.

---

## Core flows

### 1. Account lifecycle

```
Register ──► create User + Workspace (+ owner membership)
     │
     ├── email verification link sent (best-effort, 24 h TTL)
     ├── verify ──► emailVerified=true
     └── (OAuth sign-in: account created pre-verified, no email needed)

Login ──► password check (Argon2id) ──► [2FA enabled? ──► issue 10-min pending
          TOTP token ──► verify TOTP ──►] session JWT (auth purpose, $JWT_TTL)
          ──► session id recorded
          ──► logout/revoke: session id blacklisted in Redis for token TTL

Password reset ──► 30-min reset token (password_reset purpose) ──► new hash
API keys        ──► SHA-256 hash stored; sent once as `mgk_…`; used via
                   X-API-Key or `Authorization: Bearer mgk_…`
```

JWT `Purpose` claims separate **session** tokens, **email verification**,
**password reset** and **pending 2FA** tokens, so a leaked link can't be reused
as a session and vice-versa.

### 2. Contacts, lists and segments

```
CSV upload ──► import task queued (asynq)
    ├── rows parsed + deduplicated + persisted
    └── each contact optionally embedded (Postgres pgvector)

Static list = explicit membership table.
Segment    = saved query, evaluated live:
             match "all"  → every condition must match
             match "any"  → at least one must match
             conditions on: status, email, name, company, position, country,
             city, tags, last-engagement age, custom.* fields
             (operators: is / is not / contains / starts with / ends with …)

Campaign audience = union of selected lists ∪ segments.
```

### 3. Campaign lifecycle (send pipeline)

```
Create campaign (subject, sender, template, audience, schedule, tracking flags)
        │
        ▼
Scheduler tick (every interval) ──► SELECT due campaigns ──► atomically CLAIM
        │                                    (UPDATE ... WHERE status=draft,
        ▼                                     guards against double-send)
asynq task: campaign.send
        │
        ├─► status = sending
        ├─► resolve audience → contact set
        ├─► upsert campaign_recipients (status=pending)
        ├─► enqueue one task per recipient  (campaign.recipient.send)
        │
        ▼
Worker: recipient.send
        ├─► render template with contact variables (see flow 4)
        ├─► send via Resend (with X-Mailgeko-* tracking headers + tags)
        ├─► mark recipient sent (or failed with reason)
        └─► when no recipients remain: campaign status = completed/sent
```

Because each recipient is an independent queued task, a large campaign degrades
gracefully and partial failures are visible per recipient.

### 4. Email rendering & tracking links

Rendering happens per-recipient in the worker:

```
Template (MJML/HTML) ──► substitute {{var}} / {var} with contact fields
    ├─► open-tracking pixel:   <img src="BASE_URL/track/open?…">
    ├─► click links rewritten: <a href="BASE_URL/track/click?…&u=https%3A…">
    └─► unsubscribe link:      BASE_URL/track/unsubscribe?…
    all links signed (HMAC, TRACKING_SECRET): kind + campaign + contact + target
    unreachable/unsafe targets are dropped (http/https only)
```

When a recipient's email client loads the pixel or follows a link, the API:

```
/track/* ──► verify signature (tamper-proof) ──► 204/redirect
    └─► enqueue task: event.record
        ├─► update campaign_recipients (opened/clicked_at)
        ├─► update campaign_stats counters
        ├─► touch contact last-engagement
        └─► append EmailEvent to Postgres (device, platform, country, city,
                                          UA, IP) for reports
```

### 5. Delivery events via webhooks

Resend posts lifecycle events (`email.sent`, `delivered`, `opened`, `clicked`,
`bounced`, `complained`, `unsubscribed`) to `/webhooks/resend`:

```
Resend ──► POST /webhooks/resend ──► Svix signature verified (WS_WEBHOOK_SECRET)
    └─► batch events mapped to recipients via X-Mailgeko-Campaign / -Recipient
         headers on each outbound message
    └─► enqueue task: event.record (same pipeline as tracking links)
```

If the webhook secret is unset, the endpoint answers `503` and the API never
registers webhooks — deliveries are still tracked via the pixel/click links.

### 6. Analytics pipeline

```
Raw events (Postgres email_events): campaign, recipient, kind, timestamp,
                                    user-agent, IP, country (CF-IPCountry / XFF)
        │
        ├─► time-series rollups (opens/clicks per day)
        ├─► link click map (per template URL → clicks)
        ├─► device / browser / country distributions
        ├─► per-recipient send → open → click → bounce trail
        └─► drives campaign_stats totals and Reports UI
```

### 7. AI studio

```
Subject / copy request ──► OpenAI-compatible /chat/completions (AI_BASE_URL)
    ├─► streamed response, history saved (ai_history)
    └─► when no key configured: deterministic local templates are used
Vector search         ──► contact text embedded → pgvector similarity query
```

### 8. Billing & sending limits

```
Sign up / change plan ──► Stripe Checkout / portal (or local gateway)
Stripe webhook ──► plan + volume limits updated
Send time ──► worker checks remaining quota for the workspace;
             exceeded volume is rejected before dispatch
```

---

## Security model

- **Passwords.** Argon2id (via `golang.org/x/crypto`), unique salt per hash,
  constant-time verification.
- **JWTs.** HS256, purpose-scoped claims, short-lived by design; session tokens
  revocable via Redis token-id blacklist.
- **2FA.** TOTP (RFC 6238), recovery codes stored hashed; sign-in gated by a
  10-minute pending token.
- **API keys.** Only the SHA-256 digest is stored; keys start with `mgk_`, carry
  scopes, and are blocked from user-account endpoints.
- **Email link integrity.** Tracking/unsubscribe links and delivery webhooks are
  HMAC-signed; webhooks additionally verified with Svix signatures.
- **Transport & headers.** HSTS (production), `X-Frame-Options`, `X-Content-
  Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a strict
  Content-Security-Policy on both the Next.js app and every API response.
- **Rate limiting.** Fixed-window (default 300/min) per IP+path in Redis with a
  `429` on overflow.
- **Webhook body limits** and CORS allow-list scoping protect ingest endpoints.

---

## HTTP API

All endpoints live under `/api/v1` and are proxied from the web origin
(`/api/v1/*`) to the Go API.

| Area | Sample routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/2fa/*`, `/auth/verify-email`, `/auth/reset-password`, OAuth callback |
| Workspace | `GET/PATCH /workspace`, `/workspace/members`, invitations |
| Contacts | `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id`, `/contacts/import`, search |
| Lists / segments | `GET/POST /lists`, `/lists/:id/contacts`, `/segments` |
| Templates | `GET/POST/PATCH/DELETE /templates/:id` |
| Campaigns | `GET/POST /campaigns`, `GET/PATCH /campaigns/:id`, `/campaigns/:id/send`, `/campaigns/:id/stats` |
| Automations | `GET/POST/PATCH/DELETE /automations/:id` |
| Reports | `/reports/*` (overview, series, links, devices, countries) |
| AI | `/ai/*` |
| Billing | `/billing/*`, `/billing/webhook` (Stripe) |
| Notifications | `/notifications` |
| Tracking | `GET /track/open|click|unsubscribe?…` (signed, browser-facing) |
| Webhooks | `POST /webhooks/resend`, `POST /webhooks/stripe` |
| Ops | `GET /ping` (health check) |

Authentication: `Authorization: Bearer <session JWT>` for interactive routes, or
`X-API-Key: mgk_…` (or the Bearer form) for machine-to-machine routes.

---

## Repository layout

```
backend/                  Go API + worker
  cmd/api                 HTTP server + scheduler entrypoint
  cmd/worker              async worker entrypoint
  internal/
    ai/                   OpenAI-compatible chat/embedding clients
    analytics/            event ingestion + report queries
    auth/                 passwords, JWT, TOTP, OAuth
    billing/              Stripe + local gateway
    cloudinary/           uploads
    config/               env-based configuration
    database/             connection + migrations (0001–0013)
    embed/                embeddings provider (openai | static)
    engine/               render, tracking links, segment logic, import, send
    httpapi/              handlers, middleware, webhooks, tracking, rate limit
    oauth/                Google / GitHub
    queue/                asynq tasks (campaign, recipient, event, import, embed)
    scheduler/            due-campaign release loop
    sender/               Resend-compatible client
    store/                SQL queries over TiDB/MySQL
    svix/                 webhook signature verification
    track/                signed link generation/verification
    vector/               pgvector queries
src/                      Next.js app (App Router)
  app/(app)/…             dashboard, contacts, lists, campaigns, templates,
                          automations, reports, ai, settings (api-keys,
                          billing, notifications, security, team)
  app/(auth)/…            login, register, forgot/reset password, verify email
  app/api/preview/mjml/   server-side MJML render for template previews
next.config.ts            standalone output + /api /webhooks /track rewrites
Dockerfile                multi-stage build → one runtime image
docker-entrypoint.sh      starts API + worker + web in one container
docker-compose.yml        app service (bring-your-own datastores)
docker-compose.full.yml   self-contained stack (MariaDB + Redis + Postgres)
render.yaml               Render blueprint
.env.production.example   documented production env reference
```

---

## Getting started

### Option A — one command (recommended for local eval)

```bash
cp .env.example .env        # set JWT_SECRET (e.g. openssl rand -hex 32)
docker compose -f docker-compose.full.yml up --build
# open http://localhost:3000 — MariaDB, Redis and Postgres are bundled
```

### Option B — from source

Requirements: Go 1.22+, Node 20+, a MySQL/MariaDB, Redis, and a PostgreSQL
server (pgvector optional for vector search).

```bash
# 1. datastores (your local setup)
mariadbd & redis-server & postgres &

# 2. create schema — or just let the API migrate on boot
#    (migrations live in backend/internal/database/migrations)

# 3. backend
cd backend
TIDB_DSN="mailgeko:mailgeko@tcp(127.0.0.1:3306)/mailgeko?parseTime=true&charset=utf8mb4" \
POSTGRES_DSN="postgres://postgres@127.0.0.1:5432/mailgeko?sslmode=disable" \
REDIS_ADDR="127.0.0.1:6379" JWT_SECRET="dev-secret" \
RESEND_API_KEYS="re_test" EMBED_PROVIDER=static \
go run ./cmd/api &          # :8080
go run ./cmd/worker &

# 4. frontend
cd ..
pnpm install
pnpm dev                    # :3000 → proxies /api, /webhooks, /track
```

Register an account at http://localhost:3000. To capture outbound mail locally,
point `RESEND_API_ENDPOINT` at a mock Resend server.

---

## Environment variables

Full reference: `.env.production.example`. Key variables:

| Variable | Required | Description |
| --- | --- | --- |
| `APP_ENV` | no | `development` / `production` (switches HSTS, logging) |
| `PORT` | no | Web port (default `3000`); the API always binds `:8080` |
| `BASE_URL` | yes (prod) | Public origin; used in tracking/unsubscribe links |
| `JWT_SECRET` | yes | HS256 signing secret — **must be stable across restarts** |
| `TRACKING_SECRET` | yes (prod) | HMAC key for tracking/unsubscribe links |
| `TIDB_DSN` | yes | MySQL/TiDB DSN (schema auto-migrates at boot) |
| `POSTGRES_DSN` | yes | Postgres DSN for analytics + embeddings |
| `REDIS_ADDR` | yes | Redis address (queue, rate limits, sessions) |
| `RESEND_API_KEYS` | yes | Comma-separated Resend keys (needed to boot) |
| `RESEND_API_ENDPOINT` | no | Defaults to Resend; point at a mock/compatible server |
| `RESEND_WEBHOOK_SECRET` | no | Svix secret for `/webhooks/resend`; unset disables webhooks |
| `EMBED_PROVIDER` | no | `static` (default) or `openai` for pgvector search |
| `EMBED_BASE_URL`, `EMBED_MODEL`, `EMBED_DIMENSIONS` | no | Embedding endpoint config |
| `OPENAI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | no | AI studio chat completions |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | no | Stripe billing; absent → local gateway |
| `CLOUDINARY_*` | no | Asset uploads |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | no | OAuth sign-in |

---

## Deployment

### Docker

```bash
# self-contained (bundled MariaDB + Redis + Postgres)
docker compose -f docker-compose.full.yml up --build

# or with external datastores
cp .env.example .env && docker compose up --build
```

### Render

A `render.yaml` blueprint is included: **New → Blueprint**, select the repo,
then fill the `sync: false` secrets (`BASE_URL`, `JWT_SECRET`, `TRACKING_SECRET`,
`TIDB_DSN`, `POSTGRES_DSN`, `REDIS_ADDR`, `RESEND_API_KEYS`). Migrations apply
on boot; the health check is `/ping`.

Production notes:

- Set `BASE_URL` to the public origin so tracking/unsubscribe links and webhook
  callbacks resolve correctly.
- Set `RESEND_WEBHOOK_SECRET` to enable delivery webhooks (needed for reliable
  bounce/complaint data in addition to pixel tracking).
- `RESEND_API_KEYS` is required to start; use a real key in production.
- Send volume is gated by billing — the local gateway is used until Stripe
  credentials are supplied.

---

## Testing

```bash
cd backend && go test -timeout 120s ./...
bash /tmp/opencode/run/smoke.sh     # end-to-end API smoke suite (57 checks)
pnpm lint && npx tsc --noEmit        # frontend static checks
```

---

## Known limitations & roadmap

- **Automation execution** is scaffolded (visual builder + stored workflows) but
  not yet wired to the worker — scheduled sends are the supported path.
- **Segment conditions on opens/clicks** are stored but always evaluate to
  `false`; use last-engagement time instead.
- **Webhooks** are only enabled when `RESEND_WEBHOOK_SECRET` is set (no-where
  fallback to polling yet).
- **Billing** gates volume; the Stripe integration is complete, the built-in
  local gateway is the default for self-hosters.
- **Vector search** requires an embedding provider (`EMBED_PROVIDER=openai`);
  the `static` provider makes search deterministic but non-semantic.

---

## License

Proprietary / all rights reserved. See the project repository for details.
