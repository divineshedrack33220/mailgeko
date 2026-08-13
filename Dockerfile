# syntax=docker/dockerfile:1
FROM golang:1.25-alpine AS backend-builder

WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -o /out/worker ./cmd/worker \
 && CGO_ENABLED=0 GOOS=linux go build -o /out/migrate ./cmd/migrate

FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@10 && pnpm install --frozen-lockfile

COPY . .
ENV NEXT_PUBLIC_API_URL=""
RUN pnpm build

FROM node:20-alpine AS runtime

# Bundled in-memory Redis for the queue/rate-limiter/sessions when no external
# REDIS_ADDR is configured (see docker-entrypoint.sh).
RUN apk add --no-cache redis

WORKDIR /app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY --from=backend-builder /out/api /usr/local/bin/api
COPY --from=backend-builder /out/worker /usr/local/bin/worker
COPY --from=backend-builder /out/migrate /usr/local/bin/migrate
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
