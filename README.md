# Mailgeko

Email marketing platform: campaigns, contacts, lists & segments, templates,
automations, analytics and billing in one package. Frontend and backend ship
together as a single deployable unit.

## Stack

- **Frontend** — Next.js (App Router, standalone output) in `src/`
- **Backend API** — Go (`backend/cmd/api`), single binary
- **Worker** — Go (`backend/cmd/worker`), async sends/events via asynq on Redis
- **MariaDB/MySQL** — primary store (users, contacts, campaigns, templates…)
- **Redis** — queue + rate limiting + sessions
- **PostgreSQL + pgvector** — analytics and contact vector search (optional)
- **Email** — Resend-compatible API (mockable via `RESEND_API_ENDPOINT`)
- **Billing** — Stripe or a built-in local gateway

Requests to `/api/*`, `/webhooks/*` and `/track/*` are proxied by Next to the
in-process API on `127.0.0.1:8080`.

## Repository layout

```
backend/            Go API + worker (module: github.com/divineshedrack33220/mailgeko/backend)
  cmd/api           HTTP server
  cmd/worker        async worker
  internal/         store, engine, httpapi, analytics, queue, auth, …
  migrations/       SQL schema (0001-0002, 0006-0007 MySQL; 0003-0005 Postgres)
src/                Next.js app (app router, client components)
next.config.ts      standalone output + /api /webhooks /track rewrites
Dockerfile          multi-stage build producing one runtime image
docker-compose.yml  single app service (external datastores)
docker-compose.full.yml  self-contained stack (MariaDB + Redis + Postgres)
```

## Local development

Start the datastores and the mock Resend server, then the Go processes and Next.

```bash
# 1. datastores (adjust to your setup)
mariadbd --socket=/tmp/run/mariadb.sock &          # or a system service
redis-server &                                     # :6379
postgres &                                         # :5432
# (optional) a Resend-compatible mock on :8787 to capture outbound mail

# 2. apply schema once
for f in backend/internal/database/migrations/0001_init.sql \
         backend/internal/database/migrations/0002_domain.sql \
         backend/internal/database/migrations/0006_billing.sql \
         backend/internal/database/migrations/0007_settings.sql \
         backend/internal/database/migrations/0008_sending_defaults.sql \
         backend/internal/database/migrations/0009_notifications.sql; do
  mariadb -uroot mailgeko < "$f"
done
psql "postgres://postgres@127.0.0.1:5432/mailgeko" \
  -f backend/internal/database/migrations/0003_analytics.sql \
  -f backend/internal/database/migrations/0004_analytics_enrichment.sql \
  -f backend/internal/database/migrations/0005_embeddings.sql

# 3. run the backend
cd backend
TIDB_DSN="mailgeko:mailgeko@tcp(127.0.0.1:3306)/mailgeko?parseTime=true&charset=utf8mb4" \
POSTGRES_DSN="postgres://postgres@127.0.0.1:5432/mailgeko?sslmode=disable" \
REDIS_ADDR="127.0.0.1:6379" JWT_SECRET="dev-secret" RESEND_API_KEYS="re_test" \
RESEND_API_ENDPOINT="http://127.0.0.1:8787/emails" EMBED_PROVIDER=static \
go run ./cmd/api &     # :8080
go run ./cmd/worker &

# 4. run the frontend
cd .. && pnpm install && NEXT_PUBLIC_API_URL="" pnpm dev   # :3000
```

Open http://localhost:3000 and register an account.

## Tests

```bash
cd backend && go test -timeout 120s ./...
bash /tmp/opencode/run/smoke.sh        # 57 API checks against a running API
pnpm lint && npx tsc --noEmit          # frontend static checks
```

## Docker deployment

One-command stack with bundled databases (requires recent Docker Compose v2):

```bash
cp .env.example .env    # set JWT_SECRET (openssl rand -hex 32)
docker compose -f docker-compose.full.yml up --build
```

The `init-db` / `init-pg` services apply the bundled migrations on first boot,
and the API/worker binaries auto-apply any not-yet-run migrations at startup
(see `internal/database/migrate.go`). The app listens on http://localhost:3000.

External datastores (bring your own MariaDB/Redis/Postgres):

```bash
docker compose up --build   # set TIDB_DSN, REDIS_ADDR (and POSTGRES_DSN) in .env
```

## Render deployment

A `render.yaml` blueprint lives at the repo root. From the Render dashboard:
**New > Blueprint**, pick this repo, then fill the `sync: false` env vars
(`BASE_URL`, `JWT_SECRET`, `TIDB_DSN`, `POSTGRES_DSN`, `REDIS_ADDR`,
`RESEND_API_KEYS`) — see `.env.production.example` for where to get each.
Migrations auto-apply at API startup; the health check is `/ping`.

Notes for production:

- Set `BASE_URL` to your public origin so tracking/unsubscribe links and
  webhooks in sent emails resolve to the app (Next proxies `/track/*` and
  `/webhooks/*` to the API).
- Set `EMBED_PROVIDER=openai` with `OPENAI_API_KEY` for real vector search, or
  keep `static` for deterministic, key-free embeddings.
- `RESEND_API_KEYS` is required for the API to start. Set a real key, or point
  `RESEND_API_ENDPOINT` at a mock (e.g. `http://host.docker.internal:8787/emails`).
  The compose default (`re_dev_placeholder`) only boots the stack.
- Email volume is gated by billing; the local gateway is used unless Stripe
  credentials are provided.
