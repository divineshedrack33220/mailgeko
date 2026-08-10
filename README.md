# Mailgeko

Deployment wrapper for the **Mailgeko** email marketing platform (contacts,
lists & segments, templates, campaigns, automations, analytics, vector search,
AI studio, billing). The full product source lives in the nested
[`web/`](web/README.md) repository.

## Repo layout

| Path | What it is |
| --- | --- |
| `web/` | The product: Next.js frontend + Go API/worker, its own git repository |
| `README.md` (this file) | Development + deployment runbook for the wrapper |

This repository exists to make production deploys one step:

- The **`web`** repo (branch `main`) holds all source, CI, migrations and the
  Render blueprint.
- This **wrapper** repo (branch `master`) tracks `web/` as a pinned commit. A
  deploy is a push to `web@main` (builds + runs CI) followed by bumping the
  wrapper, which triggers a Render redeploy from the pushed commit.

## Deploying

Every push to `web@main`:

1. Runs **CI** (`.github/workflows/ci.yml`):
   - backend: `go build`, `go vet`, `go test ./...`, plus an opt-in MySQL 8
     integration check (`TestMySQLAutomationRunJoin`) against a service
     container;
   - frontend: `pnpm install --frozen-lockfile`, `eslint .`, `tsc --noEmit`.
2. Triggers **Render** (`.github/workflows/deploy.yml`) to rebuild and deploy
   the Docker image (Go API + worker + Next.js in one container) and
   auto-apply SQL migrations on boot.

```bash
# 1. ship the product
cd web
git add -A && git commit -m "…" && git push origin main      # CI + Render build kick off

# 2. bump the wrapper so the deploy commit is pinned
cd ..
git add web && git commit -m "web: <summary>" && git push origin master
```

Rolling back is a wrapper revert: `git revert` the wrapper commit (and, if
needed, the `web@main` commit), then push both — Render redeploys the older
pinned commit. Migrations are applied by the API at boot and are additive, so a
deploy never needs manual SQL.

## Development

See [`web/README.md`](web/README.md) for the full picture (architecture, data
model, flows, environment variables). Quick start:

```bash
cd web
cp .env.example .env            # set JWT_SECRET
docker compose -f docker-compose.full.yml up --build   # self-contained stack
# → http://localhost:3000
```

Or from source: Go 1.25 + Node 22 + pnpm 10; see `web/backend/README.md` and
`web/README.md` §9.

## Production

The live deployment runs at `https://clawmark.online`. Operations notes and the
Render blueprint are documented in `web/render.yaml` and
`web/.env.production.example`.
