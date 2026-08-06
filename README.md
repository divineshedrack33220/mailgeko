# Mailgeko

<p align="center">
  <strong>Self-hostable email marketing — audiences, campaigns, automation and analytics in one deployable unit.</strong><br/>
  Frontend · Go API · async worker · TiDB/MySQL · Redis · Postgres+pgvector · Resend · Stripe
</p>

<p align="center">
  <img alt="Go" src="https://img.shields.io/badge/Go-1.22-00ADD8?logo=go&logoColor=white"/>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white"/>
  <img alt="Docker" src="https://img.shields.io/badge/Docker-one_image-2496ED?logo=docker&logoColor=white"/>
  <img alt="License" src="https://img.shields.io/badge/license-Proprietary-informational"/>
</p>

> **The whole platform ships as one Docker image.** The Next.js web app, the Go
> API and the async worker run side by side in a single container, backed by
> MySQL/MariaDB, Redis and Postgres — so it's as easy to run on your laptop as it
> is on a production VPS.

---

## Table of contents

- [1. What is Mailgeko?](#1-what-is-mailgeko)
- [2. Feature overview](#2-feature-overview)
- [3. System architecture](#3-system-architecture)
- [4. Data model](#4-data-model)
- [5. Core flows (how it works)](#5-core-flows-how-it-works)
  - [5.1 Account lifecycle](#51-account-lifecycle)
  - [5.2 Authentication & security](#52-authentication--security)
  - [5.3 Contacts, lists & segments](#53-contacts-lists--segments)
  - [5.4 Campaign lifecycle](#54-campaign-lifecycle)
  - [5.5 Email rendering & tracking](#55-email-rendering--tracking)
  - [5.6 Delivery events & webhooks](#56-delivery-events--webhooks)
  - [5.7 Analytics pipeline](#57-analytics-pipeline)
  - [5.8 AI studio](#58-ai-studio)
  - [5.9 Billing & sending limits](#59-billing--sending-limits)
- [6. Technology stack](#6-technology-stack)
- [7. Repository layout](#7-repository-layout)
- [8. HTTP API reference](#8-http-api-reference)
- [9. Getting started](#9-getting-started)
- [10. Environment variables](#10-environment-variables)
- [11. Deployment](#11-deployment)
- [12. Security model](#12-security-model)
- [13. Testing](#13-testing)
- [14. Known limitations & roadmap](#14-known-limitations--roadmap)
- [15. License](#15-license)

---

## 1. What is Mailgeko?

Mailgeko is a complete, self-hostable **email marketing platform**. You can:

- import and manage **contacts** (CSV, tags, custom fields, dedupe),
- organize them into **lists** and dynamic **segments**,
- design reusable **templates** with contact placeholders,
- build and **schedule campaigns** with per-recipient rendering and
  **open/click/unsubscribe tracking**,
- measure everything on **analytics dashboards** (series, links, devices,
  countries, per-recipient trails),
- run an optional **AI studio** for subject lines and copy, and
- gate sending behind **Stripe billing** (or a built-in local gateway).

It's built to be boring, reliable and portable: standard SQL, Redis-backed
queues, signed webhooks, and Resend-compatible email so you can swap the
delivery provider (or point it at a mock) without changing code.

---

## 2. Feature overview

| Area | Capabilities |
| --- | --- |
| **Contacts** | CRUD, custom fields, tags, async CSV import, search, last-engagement tracking |
| **Lists & segments** | Static lists; dynamic segments (match all/any) over profile fields, tags, custom fields, engagement age |
| **Templates** | MJML/HTML with `{{placeholder}}` variables, live preview |
| **Campaigns** | Audience = lists ∪ segments, scheduling, per-recipient rendering, tracking + unsubscribe, stats, duplicates |
| **Automations** | Visual workflow builder & stored automation triggers |
| **Analytics** | Overview, time-series, link click maps, devices/browsers, countries/cities, recipient trails |
| **Vector search** | Semantic contact search via OpenAI embeddings + pgvector |
| **AI studio** | Subject/copy generation (OpenAI-compatible), usage history |
| **Billing** | Stripe plans + portal + webhooks, or local gateway; volume gating |
| **Auth** | Email+password (Argon2id), verification, reset, TOTP 2FA, Google/GitHub OAuth, scoped API keys |
| **Team** | Workspaces, roles, member invitations |
| **Ops** | In-app notifications, Cloudinary uploads, IP-based rate limiting |

---

## 3. System architecture

The system is a **monolith-with-workers**: one deployable, multiple
responsibilities. The Next.js app and the Go API talk in-process; the Go worker
consumes a Redis-backed task queue; datastores are external and pluggable.

```mermaid
flowchart TB
    subgraph Browser["User / Email client"]
        WEB["🌐 Browser"]
        CLIENT["📧 Email client"]
    end

    subgraph Image["MAILGEKO IMAGE — single container"]
        subgraph Web["Web tier"]
            NEXT["Next.js web app<br/>App Router · standalone<br/>:3000 / $PORT"]
            REWRITE["next.config.ts rewrites<br/>/api /webhooks /track /ping → 127.0.0.1:8080"]
        end

        subgraph Go["Go tier"]
            API["Go API :8080<br/>REST handlers · middleware<br/>webhooks · tracking · rate limit"]
            SCHED["Scheduler<br/>cron tick · claims due campaigns"]
            WORKER["Go Worker<br/>renders+sends emails<br/>records events · imports CSV · embeds"]
        end

        subgraph Queue["Task queue"]
            REDIS["Redis<br/>asynq queue · rate limits<br/>session blacklist"]
        end
    end

    subgraph Stores["Datastores"]
        MYSQL[("TiDB / MySQL<br/>primary store")]
        PG[("PostgreSQL + pgvector<br/>analytics · embeddings")]
    end

    subgraph SaaS["External services"]
        RESEND["📨 Resend-compatible email API"]
        STRIPE["💳 Stripe"]
        CLOUD["🖼 Cloudinary"]
        OAUTH["🔑 Google / GitHub OAuth"]
    end

    WEB --> REWRITE --> API
    API --> SCHED
    SCHED --> REDIS
    API --> REDIS
    REDIS --> WORKER
    API --> MYSQL
    WORKER --> MYSQL
    API --> PG
    WORKER --> PG
    WORKER --> RESEND
    API --> STRIPE
    API --> CLOUD
    API --> OAUTH
    CLIENT -- "open pixel / click / unsubscribe" --> API
    RESEND -- "delivery webhooks" --> API
```

### The three processes

| Process | Entrypoint | What it does |
| --- | --- | --- |
| **API** | `backend/cmd/api` | HTTP server: REST API, webhook ingestion, signed tracking endpoints, and the campaign **scheduler** that moves due campaigns into the queue |
| **Worker** | `backend/cmd/worker` | Consumes asynq tasks: per-recipient render+send, event recording, CSV imports, embeddings |
| **Web** | Next.js standalone | UI on `:3000`; reverse-proxies `/api/*`, `/webhooks/*`, `/track/*`, `/ping` to the API |

Redis is **bundled inside the image** by default: `docker-entrypoint.sh` starts an
in-memory `redis-server` on `127.0.0.1:6379` when `REDIS_ADDR` is unset or points
at localhost. Set `REDIS_ADDR` to an external server (e.g. `rediss://…` Upstash)
to use a managed Redis instead.

Migrations auto-apply when the API boots, so a deploy is **migrate-and-go** —
no separate migration job.

---

## 4. Data model

```mermaid
erDiagram
    USER ||--o{ WORKSPACE_MEMBER : "is a member of"
    WORKSPACE ||--o{ WORKSPACE_MEMBER : "has members"
    WORKSPACE ||--o{ CONTACT : "owns"
    WORKSPACE ||--o{ LIST : "owns"
    WORKSPACE ||--o{ SEGMENT : "owns"
    WORKSPACE ||--o{ TEMPLATE : "owns"
    WORKSPACE ||--o{ CAMPAIGN : "owns"
    WORKSPACE ||--o{ AUTOMATION : "owns"
    WORKSPACE ||--o{ API_KEY : "owns"
    WORKSPACE ||--o{ INVITATION : "sends"
    WORKSPACE ||--o{ NOTIFICATION : "receives"
    LIST ||--o{ LIST_MEMBER : ""
    CONTACT ||--o{ LIST_MEMBER : "in list"
    CAMPAIGN ||--o{ CAMPAIGN_RECIPIENT : "materialized for"
    CONTACT ||--o{ CAMPAIGN_RECIPIENT : "receives"
    CAMPAIGN ||--o{ EMAIL_EVENT : "records events in Postgres"
    CAMPAIGN_RECIPIENT ||--o{ EMAIL_EVENT : "has events"
    CONTACT ||--o| CONTACT_EMBEDDING : "has pgvector embedding"

    USER {
        string id PK
        string email UK
        string password_hash
        boolean email_verified
        string otp_secret
        datetime created_at
    }
    WORKSPACE {
        string id PK
        string name
        enum plan
        string stripe_customer_id
        int monthly_email_limit
    }
    CONTACT {
        string id PK
        string workspace_id FK
        string email
        string first_name
        string last_name
        json custom_fields
        json tags
        datetime last_engagement_at
    }
    LIST {
        string id PK
        string workspace_id FK
        string name
    }
    SEGMENT {
        string id PK
        string workspace_id FK
        string match_type
        json conditions
    }
    TEMPLATE {
        string id PK
        string workspace_id FK
        string subject
        text body_mjml
        text body_html
    }
    CAMPAIGN {
        string id PK
        string workspace_id FK
        string template_id FK
        string name
        enum status
        datetime scheduled_for
        boolean track_opens
        boolean track_clicks
    }
    CAMPAIGN_RECIPIENT {
        string id PK
        string campaign_id FK
        string contact_id FK
        enum status
        datetime opened_at
        datetime clicked_at
    }
    EMAIL_EVENT {
        string id PK
        string campaign_id FK
        string recipient_id FK
        string kind
        string device
        string country
        string user_agent
        datetime created_at
    }
```

Key design decisions:

- **Multi-tenant.** Every user belongs to a *workspace*; most tables carry
  `workspace_id` and all queries are scoped by it.
- **Recipients are materialized.** Starting a campaign writes one
  `campaign_recipients` row per contact, so per-recipient state and stats are
  queryable without scanning raw events.
- **Events are append-only.** Raw email events stream into Postgres
  (`email_events`) and are rolled up into campaign stats counters.
- **Embeddings.** Contacts get pgvector embeddings for semantic search; the
  `static` embedding provider disables semantics but keeps everything local.

---

## 5. Core flows (how it works)

### 5.1 Account lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant A as Go API
    participant DB as MySQL
    participant M as Mailer

    rect rgb(240,248,255)
    Note over U,M: Registration
    U->>B: Submit email + password
    B->>A: POST /api/v1/auth/register
    A->>A: Argon2id hash password
    A->>DB: create user + workspace + owner member
    A->>M: send verification email (24h TTL link)
    A-->>B: 201 Created
    U->>B: Click verification link
    B->>A: GET verify-email?token=
    A->>A: validate purpose=email_verification JWT
    A->>DB: email_verified = true
    A-->>U: Verified ✅
    end

    rect rgb(255,250,240)
    Note over U,M: Sign-in (with optional 2FA)
    U->>B: Email + password
    B->>A: POST /auth/login
    A->>A: verify Argon2id hash
    alt 2FA enabled
        A->>A: issue 10-min pending-2FA JWT
        A-->>B: challenge required
        U->>B: Enter TOTP code
        B->>A: POST /auth/2fa/verify
        A->>A: verify TOTP (RFC 6238)
    end
    A->>A: issue session JWT (purpose=auth)
    A->>DB: record session id
    A-->>B: 200 + token
    end

    rect rgb(245,255,245)
    Note over U,M: Password reset
    U->>B: Request reset
    B->>A: POST /auth/reset-password
    A->>M: send 30-min reset link (purpose=password_reset)
    U->>B: Click reset link → set new password
    B->>A: POST /auth/reset-password/confirm
    A->>DB: write new Argon2id hash
    end
```

**JWT purposes.** Every token carries a `purpose` claim, so a verification link,
a reset link, a 2FA challenge and a real session can never be used
interchangeably:

| Purpose | TTL | Issued when |
| --- | --- | --- |
| `auth` (session) | `$JWT_TTL` (env) | Successful login / 2FA |
| `email_verification` | 24 h | Registration |
| `password_reset` | 30 min | Reset request |
| *pending 2FA* | 10 min | Login when 2FA enabled, before TOTP verified |

### 5.2 Authentication & security

```mermaid
flowchart LR
    REQ["HTTP request"] --> AUTH{"Has API key?<br/>X-API-Key or Bearer mgk_…"}
    AUTH -- yes --> HASH["SHA-256 of key"]
    HASH --> LOOKUP["Lookup key hash in MySQL"]
    LOOKUP --> OKKEY{"Valid + not expired?"}
    OKKEY -- yes --> BLOCK{"Path allowed for keys?<br/>(blocked: /auth, /me, /billing…)"}
    BLOCK -- yes --> SCOPES["Check key scopes"]
    SCOPES --> PASS["✅ Serve request as API identity"]
    OKKEY -- no --> 401["401 Unauthorized"]
    BLOCK -- no --> 403["403 Forbidden"]

    AUTH -- no --> JWT{"Bearer session JWT?"}
    JWT -- yes --> PARSE["Validate signature + expiry"]
    PARSE --> REVOKED{"Session blacklisted in Redis?"}
    REVOKED -- no --> SESSION["✅ Serve request as user"]
    REVOKED -- yes --> 401
    JWT -- no --> 401
```

Every HTTP response also carries a strict security-header set (HSTS in prod,
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, and a narrow CSP). See [§12 Security model](#12-security-model).

### 5.3 Contacts, lists & segments

```mermaid
flowchart TB
    SRC["Contacts come from"] --> M1["📥 CSV upload"]
    SRC --> M2["➕ Manual create / API"]
    SRC --> M3["🔄 OAuth signup (auto-saved)"]

    M1 --> IMPORT["asynq task: contacts.import<br/>(worker)"]
    IMPORT --> PARSE["Parse + dedupe rows"]
    PARSE --> PERSIST["Persist contacts (MySQL)"]
    PERSIST --> EMBED["Optional: embed text → pgvector (Postgres)"]

    M2 --> PERSIST
    M3 --> PERSIST

    PERSIST --> ORG{"Organize"}
    ORG --> LIST["📁 Static lists<br/>explicit membership table"]
    ORG --> SEG["🎯 Dynamic segments<br/>evaluated live at send time"]

    SEG --> MATCH{"match_type"}
    MATCH -- "all" --> ALL["Every condition must match"]
    MATCH -- "any" --> ANY["At least one condition matches"]

    ALL --> CAMPAIGN["🎬 Campaign audience =<br/>union(list_selected ∪ segment_matches)"]
    ANY --> CAMPAIGN
```

Condition fields: `status`, `email`, `first_name`, `last_name`, `company`,
`position`, `country`, `city`, `tags`, `last_engagement_at` (relative ages like
"30 days ago"), and any `custom.*` field — with operators *is / is not /
contains / does not contain / starts with / ends with / is before / is after*.

### 5.4 Campaign lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft: create campaign
    draft --> scheduled: choose send time
    scheduled --> sending: "scheduler claims (atomic claim — guarded against double-send)"
    sending --> sending: per-recipient tasks progress
    sending --> completed: all recipients processed
    sending --> failed: claim or enqueue error
    completed --> [*]
    failed --> sending: retry
```

What happens at each stage:

```mermaid
sequenceDiagram
    autonumber
    participant S as Scheduler
    participant A as Go API
    participant R as Redis-asynq
    participant W as Worker
    participant DB as MySQL
    participant RE as Resend

    Note over S,DB: The send is driven by the queue, never by a big synchronous loop.
    S->>DB: SELECT due campaigns
    S->>DB: CLAIM (UPDATE status=scheduled→sending)
    S->>A: EnqueueCampaignSend(campaignID)
    A->>R: task: campaign.send
    W->>R: dequeue campaign.send
    W->>DB: resolve audience (lists ∪ segments)
    W->>DB: upsert campaign_recipients (status=pending)
    loop for each recipient
        W->>R: enqueue task: campaign.recipient.send
    end

    W->>R: dequeue recipient.send
    W->>DB: load contact + template
    W->>W: render with {{vars}} + signed tracking links
    W->>RE: POST /emails (X-Mailgeko headers, tags)
    alt 2xx
        W->>DB: recipient.status = sent
    else error
        W->>DB: recipient.status = failed + reason
    end

    W->>DB: all done → campaign.status = completed
    W->>DB: insert in-app notification
```

Because each recipient is an **independent queued task**, a 100k-contact campaign
degrades gracefully, retries cleanly, and partial failures are visible per
recipient rather than as one giant job.

### 5.5 Email rendering & tracking

Every email is rendered per-recipient in the worker. Variables are substituted
and every trackable element is signed with `TRACKING_SECRET` (HMAC) so links
cannot be forged or re-targeted.

```mermaid
flowchart LR
    T["Template MJML/HTML"] --> SUB["Substitute {{var}} / {var}<br/>with contact fields"]
    SUB --> PIXEL["🧩 Open-tracking pixel<br/>BASE_URL/track/open?…"]
    SUB --> LINKS["🔗 Click links rewritten<br/>BASE_URL/track/click?…&u=<encoded target>"]
    SUB --> UNSUB["🚫 Unsubscribe link<br/>BASE_URL/track/unsubscribe?…"]
    PIXEL --> SIGN["Sign all URLs<br/>(kind + campaign + contact + target) + HMAC"]
    LINKS --> SIGN
    UNSUB --> SIGN
    SIGN --> SEND["Send via Resend"]
```

When the recipient's mail client loads the pixel or follows a link:

```mermaid
sequenceDiagram
    autonumber
    actor C as Email client
    participant N as Next.js proxy
    participant A as API
    participant R as Redis
    participant W as Worker
    participant DB as MySQL
    participant PG as Postgres

    C->>N: GET /track/open|click|unsubscribe?…&sig=
    N->>A: proxy to :8080
    A->>A: verify HMAC signature
    alt signature invalid
        A-->>C: 400 / redirect to error
    else unsubscribe
        A->>DB: mark recipient + contact unsubscribed
        A-->>C: 204 / goodbye page
    else valid
        A-->>C: 204 (pixel) / 302 → original URL (click)
        A->>R: enqueue task: event.record
        W->>R: dequeue event.record
        W->>DB: update campaign_recipients (opened_at / clicked_at)
        W->>DB: update campaign_stats counters
        W->>DB: touch contact last_engagement_at
        W->>PG: append EmailEvent (device, country, UA, IP…)
    end
```

Only `http`/`https` targets are rewritten; anything else is dropped, and links
without a signature are rejected.

### 5.6 Delivery events & webhooks

Resend lifecycle events (`email.sent`, `delivered`, `opened`, `clicked`,
`bounced`, `complained`, `unsubscribed`) arrive at `/webhooks/resend`:

```mermaid
sequenceDiagram
    autonumber
    participant RE as Resend
    participant N as Next.js proxy
    participant A as API
    participant S as Svix verifier
    participant R as Redis
    participant W as Worker
    participant DB as MySQL

    RE->>N: POST /webhooks/resend (Svix-Signature)
    N->>A: proxy to :8080
    A->>S: verify signature (RESEND_WEBHOOK_SECRET)
    alt no secret configured
        A-->>RE: 503 (webhooks disabled)
    else signature invalid
        A-->>RE: 401
    else valid
        A->>A: batch events → map via X-Mailgeko-Campaign / -Recipient headers
        A->>R: enqueue task: event.record per event
        W->>DB: same pipeline as tracking links
        A-->>RE: 200 OK
    end
```

If `RESEND_WEBHOOK_SECRET` is not set, the endpoint returns `503` and webhooks
are simply not registered — open/click tracking still works via the pixel/links
in [§5.5](#55-email-rendering--tracking).

### 5.7 Analytics pipeline

```mermaid
flowchart LR
    E["email_events (Postgres)<br/>kind · timestamp · UA · IP · country"] --> ROLL["Rollups"]
    ROLL --> S1["📈 Time-series<br/>opens/clicks per day"]
    ROLL --> S2["🔗 Link click map<br/>per template URL"]
    ROLL --> S3["📱 Devices / browsers<br/>from user-agent"]
    ROLL --> S4["🌍 Countries / cities<br/>from CF-IPCountry / X-Forwarded-For"]
    ROLL --> S5["🧭 Per-recipient trail<br/>sent → open → click → bounce"]
    S1 --> UI["Reports UI"]
    S2 --> UI
    S3 --> UI
    S4 --> UI
    S5 --> UI
```

### 5.8 AI studio

```mermaid
flowchart TB
    REQ["Generate subject / copy"] --> KEY{"AI key configured?"}
    KEY -- yes --> CHAT["POST {AI_BASE_URL}/chat/completions<br/>(OpenAI-compatible)"]
    CHAT --> STREAM["Streamed response"]
    STREAM --> SAVE["Save to ai_history"]
    KEY -- no --> LOCAL["Deterministic local templates"]
    LOCAL --> SAVE
    SAVE --> UI["AI studio panel"]
    SEARCH["Search contacts semantically"] --> VEC["Embed query → pgvector<br/>similarity search"]
    VEC --> RESULT["Ranked matching contacts"]
```

### 5.9 Billing & sending limits

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant A as API
    participant S as Stripe
    participant W as Worker
    participant DB as MySQL

    U->>A: Choose plan / checkout
    A->>S: Create Checkout Session (Starter/Growth/Scale)
    A-->>U: redirect to Stripe
    U->>S: Pay
    S->>A: webhook: checkout.session.completed
    A->>DB: update plan + monthly limit
    S->>A: webhook: customer.subscription.updated (volume changes)

    Note over W,DB: At send time
    W->>DB: check remaining quota
    alt quota exhausted
        W->>W: reject send (over limit)
    else quota available
        W->>W: proceed with delivery
    end
```

Without Stripe credentials, a built-in **local gateway** is used instead, so
self-hosters get the same plan/limit mechanics with zero external setup.

---

## 6. Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Recharts, MJML |
| API | Go 1.22+, chi router, `jmoiron/sqlx`, `golang-jwt/jwt/v5`, `hibiken/asynq` |
| Databases | TiDB/MySQL (primary), PostgreSQL + pgvector (analytics, embeddings) |
| Queue / cache | Redis (`go-redis/v9`), asynq task queue |
| Email | Resend-compatible REST client |
| Auth | Argon2id, purpose-scoped JWT, TOTP (`pquerna/otp`), OAuth 2.0 |
| Payments | Stripe SDK + webhooks, or built-in local gateway |
| AI | OpenAI-compatible chat completions; `openai` or `static` embeddings |
| Deploy | Docker multi-stage build, docker-compose, Render blueprint |

---

## 7. Repository layout

```
.
├── backend/                  # Go API + worker (module: …/mailgeko/backend)
│   ├── cmd/
│   │   ├── api/              # HTTP server + scheduler entrypoint
│   │   └── worker/           # async worker entrypoint
│   └── internal/
│       ├── ai/               # OpenAI-compatible chat/embedding clients
│       ├── analytics/        # event ingestion + report queries
│       ├── auth/             # passwords, JWT, TOTP, OAuth
│       ├── billing/          # Stripe + local gateway
│       ├── cloudinary/       # uploads
│       ├── config/           # env-based configuration
│       ├── database/         # connections + migrations (0001–0013)
│       ├── embed/            # embedding provider (openai | static)
│       ├── engine/           # render, tracking links, segments, import, send
│       ├── httpapi/          # handlers, middleware, webhooks, tracking
│       ├── oauth/            # Google / GitHub
│       ├── queue/            # asynq tasks (campaign, recipient, event, import)
│       ├── scheduler/        # due-campaign release loop
│       ├── sender/           # Resend-compatible client
│       ├── store/            # SQL queries over TiDB/MySQL
│       ├── svix/             # webhook signature verification
│       ├── track/            # signed link generation/verification
│       └── vector/           # pgvector queries
├── src/                      # Next.js app
│   ├── app/(app)/…           # dashboard, contacts, lists, campaigns, templates,
│   │                         #   automations, reports, ai, settings/*
│   ├── app/(auth)/…          # login, register, forgot/reset password, verify
│   └── app/api/preview/mjml/ # server-side MJML render for previews
├── next.config.ts            # standalone output + /api /webhooks /track rewrites
├── Dockerfile                # multi-stage build → one runtime image
├── docker-entrypoint.sh      # starts API + worker + web in one container
├── docker-compose.yml        # app service (bring-your-own datastores)
├── docker-compose.full.yml   # self-contained stack (MariaDB + Redis + Postgres)
├── render.yaml               # Render blueprint
└── .env.production.example   # documented production env reference
```

---

## 8. HTTP API reference

Everything under `/api/v1` is reverse-proxied from the web origin.

| Area | Sample routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/2fa/*`, `/auth/verify-email`, `/auth/reset-password`, OAuth callback |
| Workspace | `GET/PATCH /workspace`, `/workspace/members`, invitations |
| Contacts | `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id`, `/contacts/import`, search |
| Lists / segments | `GET/POST /lists`, `/lists/:id/contacts`, `/segments` |
| Templates | `GET/POST/PATCH/DELETE /templates/:id` |
| Campaigns | `GET/POST /campaigns`, `GET/PATCH /campaigns/:id`, `/campaigns/:id/send`, `/campaigns/:id/stats` |
| Automations | `GET/POST/PATCH/DELETE /automations/:id` |
| Reports | `/reports/*` (overview, series, links, devices, countries) |
| AI | `/ai/*` |
| Billing | `/billing/*`, `/billing/webhook` |
| Notifications | `/notifications` |
| Tracking | `GET /track/open|click|unsubscribe?…` (signed, browser-facing) |
| Webhooks | `POST /webhooks/resend`, `POST /webhooks/stripe` |
| Ops | `GET /ping` |

**Auth:** `Authorization: Bearer <session JWT>` for interactive routes;
`X-API-Key: mgk_…` (or the Bearer form) for machine-to-machine routes.

---

## 9. Getting started

### Option A — one command (self-contained stack)

```bash
cp .env.example .env            # set JWT_SECRET (openssl rand -hex 32)
docker compose -f docker-compose.full.yml up --build
# open http://localhost:3000 — MariaDB, Redis and Postgres are bundled
```

### Option B — from source

Requirements: Go 1.22+, Node 20+, MySQL/MariaDB, Redis, PostgreSQL (pgvector
optional).

```bash
# 1. datastores (your local setup)
mariadbd & redis-server & postgres &

# 2. backend — schema auto-migrates on boot
cd backend
TIDB_DSN="mailgeko:mailgeko@tcp(127.0.0.1:3306)/mailgeko?parseTime=true&charset=utf8mb4" \
POSTGRES_DSN="postgres://postgres@127.0.0.1:5432/mailgeko?sslmode=disable" \
REDIS_ADDR="127.0.0.1:6379" JWT_SECRET="dev-secret" \
RESEND_API_KEYS="re_test" EMBED_PROVIDER=static \
go run ./cmd/api &              # :8080
go run ./cmd/worker &

# 3. frontend
cd ..
pnpm install
pnpm dev                        # :3000 → proxies /api, /webhooks, /track
```

Register an account at http://localhost:3000. For outbound mail, point
`RESEND_API_ENDPOINT` at a mock Resend-compatible server.

---

## 10. Environment variables

Full reference: `.env.production.example`.

| Variable | Required | Description |
| --- | --- | --- |
| `APP_ENV` | no | `development` / `production` (HSTS, logging) |
| `PORT` | no | Web port (default `3000`); API always binds `:8080` |
| `BASE_URL` | yes (prod) | Public origin; used in tracking/unsubscribe links |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist; defaults to the `BASE_URL` origin (plus localhost in dev) |
| `JWT_SECRET` | yes | HS256 signing secret — **stable across restarts** |
| `TRACKING_SECRET` | yes (prod) | HMAC key for tracking/unsubscribe links |
| `TIDB_DSN` | yes | MySQL/TiDB DSN (auto-migrates at boot) |
| `POSTGRES_DSN` | yes | Postgres DSN for analytics + embeddings |
| `REDIS_ADDR` | no | Redis address (queue, rate limits, sessions). **Leave empty to use the bundled in-container Redis**; set to an external server (e.g. `rediss://…`) to use a managed one |
| `RESEND_API_KEYS` | yes | Comma-separated Resend keys (needed to boot) |
| `RESEND_API_ENDPOINT` | no | Defaults to Resend; point at a mock |
| `RESEND_WEBHOOK_SECRET` | no | Svix secret for `/webhooks/resend`; unset → webhooks disabled |
| `EMBED_PROVIDER` | no | `static` (default) or `openai` for pgvector search |
| `EMBED_BASE_URL` / `EMBED_MODEL` / `EMBED_DIMENSIONS` | no | Embedding endpoint config |
| `OPENAI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | no | AI studio chat completions |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` | no | Stripe billing; absent → local gateway |
| `CLOUDINARY_*` | no | Asset uploads |
| `GOOGLE_CLIENT_ID/SECRET` / `GITHUB_CLIENT_ID/SECRET` | no | OAuth sign-in |

---

## 11. Deployment

### Docker

```bash
# self-contained (bundled MariaDB + Redis + Postgres)
docker compose -f docker-compose.full.yml up --build

# or bring your own datastores
cp .env.example .env && docker compose up --build
```

### Render

A `render.yaml` blueprint is included. **New → Blueprint** → select the repo →
fill the `sync: false` secrets (`BASE_URL`, `JWT_SECRET`, `TRACKING_SECRET`,
`TIDB_DSN`, `POSTGRES_DSN`, `REDIS_ADDR`, `RESEND_API_KEYS`). Migrations run on
boot; health check is `/ping`.

Production notes:

- Set `BASE_URL` to your public origin so tracking/unsubscribe links and
  webhook callbacks resolve to the right host.
- Set `RESEND_WEBHOOK_SECRET` to enable delivery webhooks (bounces/complaints)
  in addition to pixel tracking.
- `RESEND_API_KEYS` is required to start — use a real key in production.
- Sending is gated by billing; the local gateway is used until Stripe
  credentials are supplied.

---

## 12. Security model

```mermaid
flowchart LR
    subgraph H["Defense in depth"]
        A["🔑 Argon2id passwords<br/>+ unique salts"]
        B["🎟 Purpose-scoped JWTs<br/>+ Redis token blacklist"]
        C["🧮 TOTP 2FA<br/>+ hashed recovery codes"]
        D["🔐 API keys: SHA-256 only<br/>mgk_ prefix · scopes · route blocking"]
        E["✍️ HMAC-signed tracking<br/>+ Svix-signed webhooks"]
        F["🛡 Strict security headers<br/>CSP · HSTS · frame/type/ref/policy"]
        G["⏱ Rate limiting 300/min<br/>per IP+path (Redis)"]
        H["📦 Webhook body limits<br/>+ CORS allow-list"]
    end
```

- **Passwords.** Argon2id (`golang.org/x/crypto`), unique salt per hash,
  constant-time verification.
- **Tokens.** HS256 JWTs with a `purpose` claim; session tokens revocable by
  blacklisting the token id in Redis.
- **2FA.** TOTP (RFC 6238); recovery codes stored hashed; sign-in gated by a
  10-minute pending token.
- **API keys.** Only the SHA-256 digest is stored; keys start with `mgk_`, carry
  scopes, and are blocked from user-account endpoints.
- **Email link integrity.** Tracking/unsubscribe links and delivery webhooks are
  HMAC-signed; webhooks additionally verified with Svix signatures.
- **Transport & headers.** HSTS (production) plus `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and a strict
  CSP on both the Next.js app and every API response.
- **Rate limiting.** Fixed window (default 300/min) per IP+path in Redis, `429`
  on overflow.

---

## 13. Testing

```bash
cd backend && go test -timeout 120s ./...
bash /tmp/opencode/run/smoke.sh     # end-to-end API smoke suite (57 checks)
pnpm lint && npx tsc --noEmit        # frontend static checks
```

---

## 14. Known limitations & roadmap

- **Automation execution** is scaffolded (visual builder + stored workflows) but
  not yet wired to the worker — scheduled sends are the supported path today.
- **Segment conditions on opens/clicks** are stored but evaluate to `false`;
  use the *last engagement* condition instead.
- **Webhooks** are enabled only when `RESEND_WEBHOOK_SECRET` is set; no polling
  fallback yet.
- **Billing** gates volume via Stripe; the built-in local gateway is the default
  for self-hosters.
- **Vector search** needs an embedding provider (`EMBED_PROVIDER=openai`); the
  `static` provider keeps search deterministic but non-semantic.

---

## 15. License

Proprietary / all rights reserved.
