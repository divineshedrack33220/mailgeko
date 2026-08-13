# Deployment runbook

Mailgeko ships as a **single Docker image** that can run the API, the worker, and
the Next.js web process together (`MAILGEKO_ROLE=all`) or split across replicas
for horizontal scaling. This runbook covers the split deployment.

## Process roles

`MAILGEKO_ROLE` selects what a container starts:

| Role       | Processes                                          | Use case                          |
| ---------- | -------------------------------------------------- | --------------------------------- |
| `all`      | API + worker + web (default)                       | Single-box / simplest deploy      |
| `api`      | API only                                           | Horizontal API scaling            |
| `worker`   | Worker only                                        | Queue throughput scaling          |
| `web`      | Next.js only                                       | Edge/static distribution          |
| `migrate`  | Run schema migrations, then exit                   | One-off migration job             |

The API listens on `:8080`; the web process binds to `$PORT` (Render-injected)
or `:3000`. In split mode the web process must reach the API, so either run a
web + api process on the same host or point the Next.js rewrites at the API
service (see `next.config.ts`).

## Prerequisites for scaling out

A single `all` container bundles an in-memory Redis, which does not work across
replicas (each instance would have its own queue/rate-limit state). Before
splitting:

- **TiDB / MySQL** — managed instance, as normal.
- **Redis** — external, persistent (e.g. Upstash): set `REDIS_ADDR`.
- **Postgres** — optional, for analytics + vector search.
- **Object storage** — not bundled; keep Cloudinary uploads enabled or run the
  web + API on shared volumes only for `public/uploads` (not used in the image).

## Layout

For a small multi-replica deployment (e.g. Render or docker-compose):

```
                ┌─────────────────────────────────────────┐
 internet ─────►│ web replica 1 (MAILGEKO_ROLE=web)       │
                │ web replica 2 (MAILGEKO_ROLE=web)       │  next.config rewrites
                │                                          │────► API service
                ├─────────────────────────────────────────┤        │
                │ api replica 1 (MAILGEKO_ROLE=api)       │        │  /api /track
                │ api replica 2 (MAILGEKO_ROLE=api)       │        │  /webhooks /ping /readyz
                ├─────────────────────────────────────────┤        ▼
                │ worker replica(s) (MAILGEKO_ROLE=worker)│   TiDB · Redis · Postgres
                └─────────────────────────────────────────┘
```

- **API**: scale 2+ replicas. All replicas must share the same `JWT_SECRET`,
  `TRACKING_SECRET`, `REDIS_ADDR` (sessions/rate-limits/queues live there).
  Run with `AUTO_MIGRATE=false`.
- **Worker**: scale as queue depth requires. Exactly the same env as the API
  (`TIDB_DSN`, `POSTGRES_DSN`, `REDIS_ADDR`, `RESEND_API_KEYS`).
- **Web**: stateless; scale freely behind a load balancer.

## Migrations with replicas

With multiple API replicas, boot-time migrations would race. Apply schema
changes once, before scaling the API:

```sh
# One-off migration job (built into the image):
docker run --rm \
  -e TIDB_DSN="$TIDB_DSN" \
  -e POSTGRES_DSN="$POSTGRES_DSN" \
  -e AUTO_MIGRATE=false \
  --entrypoint docker-entrypoint.sh \
  your-image:tag
```

But since the image runs `MAILGEKO_ROLE=migrate` through the same entrypoint,
the shortest form is:

```sh
docker run --rm \
  -e MAILGEKO_ROLE=migrate \
  -e TIDB_DSN="$TIDB_DSN" \
  -e POSTGRES_DSN="$POSTGRES_DSN" \
  -e AUTO_MIGRATE=false \
  your-image:tag
```

On Render, add a one-off job service running the same image with
`MAILGEKO_ROLE=migrate` and `AUTO_MIGRATE=false`, then deploy API replicas.

## Health checks

| Endpoint   | Purpose                                                              |
| ---------- | -------------------------------------------------------------------- |
| `/ping`    | Liveness — no dependencies. Use for platform probes (Render).        |
| `/readyz`  | Readiness — pings TiDB, Redis/queue and optional Postgres; 503 when a dependency is down. Use for load balancers / orchestrators. |
| `/metrics` | Prometheus scrape endpoint.                                          |
| `/healthz` | Status banner (no dependency checks).                                |

Keep platform liveness probes on `/ping` so a transient dependency blip does
not restart the container; route traffic away with `/readyz` instead.

## docker-compose example

```yaml
services:
  api:
    image: mailgeko:latest
    environment:
      MAILGEKO_ROLE: api
      AUTO_MIGRATE: "false"
      TIDB_DSN: "${TIDB_DSN}"
      POSTGRES_DSN: "${POSTGRES_DSN}"
      REDIS_ADDR: "${REDIS_ADDR}"
      JWT_SECRET: "${JWT_SECRET}"
      BASE_URL: "https://mail.example.com"
    deploy:
      replicas: 2

  worker:
    image: mailgeko:latest
    environment:
      MAILGEKO_ROLE: worker
      TIDB_DSN: "${TIDB_DSN}"
      POSTGRES_DSN: "${POSTGRES_DSN}"
      REDIS_ADDR: "${REDIS_ADDR}"
      RESEND_API_KEYS: "${RESEND_API_KEYS}"

  migrate:
    image: mailgeko:latest
    environment:
      MAILGEKO_ROLE: migrate
      AUTO_MIGRATE: "false"
      TIDB_DSN: "${TIDB_DSN}"
      POSTGRES_DSN: "${POSTGRES_DSN}"
    profiles: [migrate]
```

Run migrations before deploying a release:

```sh
docker compose --profile migrate run --rm migrate
```

## Verification

After rolling out, confirm each replica is healthy:

```sh
curl -fsS https://app.example.com/ping          # 200, no deps
curl -fsS https://app.example.com/readyz        # {"status":"ok","checks":{...}}
curl -fsS https://app.example.com/metrics | head
```

Then send a test campaign and watch `curl /metrics` for queue/task counters to
confirm the worker replica is consuming.

## Local single-box

Everything above is unnecessary for a single instance — the default
(`MAILGEKO_ROLE=all`, bundled Redis, `AUTO_MIGRATE=true`) runs the whole stack
in one container.
