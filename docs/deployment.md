# Neuraal — Deployment Guide

**Last updated:** 2026-02-18

This document covers the deployment architecture, Docker configuration, CI/CD pipeline, and production operations for Neuraal.

---

## 1. Architecture Overview

```
Developer -> GitHub (push) -> GitHub Actions CI -> GHCR (image) -> VPS (deploy)
                                    |
                              [lint + test + E2E]
```

- **Source control**: GitHub (branches: `main`, `develop`)
- **Container registry**: GitHub Container Registry (GHCR)
- **CI/CD**: GitHub Actions (two workflows)
- **Production runtime**: Docker Compose on VPS

---

## 2. Docker Multi-Stage Build

The `Dockerfile` uses three stages to produce a minimal production image.

### Stage 1: deps

```dockerfile
FROM node:20-alpine AS deps
```

- Enables corepack (pnpm).
- Copies `package.json` and `pnpm-lock.yaml`.
- Runs `pnpm install --frozen-lockfile`.

### Stage 2: build

```dockerfile
FROM node:20-alpine AS build
```

- Copies `node_modules` from deps stage.
- Copies full source code.
- Generates Prisma client (`pnpm prisma generate`).
- Builds Next.js (`pnpm build`).
- Builds BullMQ workers (`pnpm build:workers`).

### Stage 3: runtime

```dockerfile
FROM node:20-alpine AS runtime
```

- Sets `NODE_ENV=production`.
- Copies only production artifacts:
  - `node_modules`, `.next`, `public`, `prisma`, `src/generated` (Prisma client), `dist` (workers), `next.config.ts`, `prisma.config.ts`.
- No source code, dev dependencies, or build tools.
- Exposes port 3000.
- Entry point: `pnpm start`.

---

## 3. CI Pipeline

### Workflow: `ci.yml`

**Triggers**: Push to `main`/`develop`, PRs targeting those branches.

**Concurrency**: Cancels in-progress runs for the same ref.

### Job 1: Lint & Typecheck

```
pnpm install -> prisma generate -> pnpm lint -> pnpm typecheck
```

### Job 2: Unit, Integration & Coverage Gate

```
pnpm install -> prisma generate -> pnpm test:coverage
```

Depends on Job 1 passing.

### Job 3: E2E Tests (Playwright)

Services:

- `pgvector/pgvector:pg16` — PostgreSQL with vector support
- `redis:7` — Redis for job queues

Steps:

1. Install dependencies and generate Prisma client.
2. Install Playwright Chromium.
3. Run database migrations (`prisma migrate deploy`).
4. Seed E2E auth data (`pnpm db:seed:e2e`).
5. Build the application.
6. Run E2E tests (`pnpm test:e2e`).
7. Upload Playwright report as artifact on failure (7-day retention).

Depends on Job 2 passing.

---

## 4. Build & Deploy Pipeline

### Workflow: `build-and-deploy.yml`

**Triggers**:

- Push to `develop` (direct build + deploy).
- CI workflow completion on `main` (build + deploy only if CI succeeded).

### Build & Push

1. Docker Buildx setup.
2. Login to GHCR using `GITHUB_TOKEN`.
3. Build image with GitHub Actions cache (`type=gha`).
4. Push with tags:
   - `ghcr.io/{owner}/neuraal:latest`
   - `ghcr.io/{owner}/neuraal:{commit-sha}`

### Deploy via SSH

Each deploy executes the following safety sequence on the VPS:

1. SSH to VPS using `appleboy/ssh-action`.
2. Save current tag as rollback reference (`.last_good_tag`).
3. **Create PostgreSQL backup** (`pg_dump` → gzip) before any changes.
4. Apply backup retention policy (keep last 7; delete only if >14 days old).
5. Login to GHCR and pull the new image.
6. Run Prisma migrations (`prisma migrate deploy`).
   - On migration failure: **automatic rollback** to previous tag.
7. Restart services (`docker compose up -d --remove-orphans`).
8. Run health check loop (up to 10 min, polling `/api/health`).
   - On success: save tag as `.last_good_tag`.
   - On failure: **automatic rollback** to `.last_good_tag`, pull + restart, re-check health.

See [neuraal-deploy-rollback-backup-manual.md](neuraal-deploy-rollback-backup-manual.md) for the complete deploy safety documentation including manual recovery procedures.

### Required GitHub Secrets

| Secret            | Purpose                       |
| ----------------- | ----------------------------- |
| `VPS_HOST`        | VPS hostname/IP               |
| `VPS_USER`        | SSH username                  |
| `VPS_SSH_KEY`     | SSH private key               |
| `VPS_PORT`        | SSH port                      |
| `GHCR_PULL_TOKEN` | PAT for pulling images on VPS |
| `GHCR_PULL_USER`  | GitHub username for GHCR auth |

### Required GitHub Variables

| Variable           | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `CI_POSTGRES_USER` | Postgres user for CI (default: `postgres`)         |
| `CI_POSTGRES_DB`   | Postgres database for CI (default: `neuraal_test`) |

---

## 5. Production Compose

### `docker-compose.prod.yml`

| Service      | Image                    | Ports      | Volumes               | Health Check            |
| ------------ | ------------------------ | ---------- | --------------------- | ----------------------- |
| **postgres** | `pgvector/pgvector:pg16` | 5432       | `neuraal_pgdata`      | `pg_isready`            |
| **redis**    | `redis:7-alpine`         | 6379       | `neuraal_redisdata`   | `redis-cli ping`        |
| **minio**    | `minio/minio:latest`     | 9000, 9001 | `neuraal_minio_data`  | HTTP health endpoint    |
| **n8n**      | `n8nio/n8n:latest`       | 5678       | `neuraal_n8n_data`    | HTTP healthz            |
| **ollama**   | `ollama/ollama:latest`   | 11434      | `neuraal_ollama_data` | `ollama list`           |
| **app**      | `${APP_IMAGE}` (GHCR)    | 3000       | -                     | Depends on all services |

All services:

- `restart: unless-stopped`
- Health checks with interval/timeout/retries
- Named persistent volumes

### Starting Production

```bash
cd /srv/neuraal
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Running Migrations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm app pnpm prisma migrate deploy
```

---

## 6. Production Environment Variables

The `.env.prod` file must contain (at minimum):

```bash
# Database
DATABASE_URL=postgresql://neuraal:PASSWORD@postgres:5432/neuraal

# Redis
REDIS_URL=redis://redis:6379

# S3/MinIO
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=neuraal
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# Auth
AUTH_JWT_SECRET=...  # Minimum 32 characters, cryptographically random
AUTH_ACCESS_TTL_SECONDS=900
AUTH_REFRESH_TTL_DAYS=30
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax

# n8n
N8N_BASE_URL=http://n8n:5678
N8N_WEBHOOK_SECRET=...  # Shared secret for HMAC signing
N8N_SUMMARY_WEBHOOK_URL=http://n8n:5678/webhook/...
N8N_TRANSCRIPT_WEBHOOK_URL=http://n8n:5678/webhook/...
N8N_REMINDER_WEBHOOK_URL=http://n8n:5678/webhook/...

# Ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBED_MODEL=qwen3-embedding:latest
EMBEDDING_DIM=768

# Sentry
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# App
APP_BASE_URL=https://neuraal.yourdomain.com
NEXT_PUBLIC_API_BASE_URL=https://neuraal.yourdomain.com

# Docker
APP_IMAGE=ghcr.io/OWNER/neuraal:latest
POSTGRES_PASSWORD=...
MINIO_ROOT_USER=...
MINIO_ROOT_PASSWORD=...
```

**Never commit `.env.prod` to version control.**

---

## 7. SSL / Reverse Proxy

Neuraal uses **Caddy** as a reverse proxy with automatic TLS certificate management via Let's Encrypt/ZeroSSL.

### Caddy (production)

Caddy runs as a Docker Compose service alongside the app and handles:

- Automatic HTTPS certificate provisioning and renewal.
- HTTP → HTTPS redirect.
- Reverse proxying to the Next.js app on port 3000.

```
neuraal.app {
    reverse_proxy app:3000
}
```

The deploy health check verifies the full stack through Caddy:

```bash
curl -fsS --resolve neuraal.app:443:127.0.0.1 https://neuraal.app/api/health
```

### Alternative: Nginx

If you prefer Nginx, configure SSL termination with Let's Encrypt/Certbot:

```nginx
server {
    listen 443 ssl http2;
    server_name neuraal.app;

    ssl_certificate     /etc/letsencrypt/live/neuraal.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/neuraal.app/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. Backup Strategy

### Database (PostgreSQL)

**Automatic (CI/CD):** Every deployment creates a compressed PostgreSQL backup (`pg_dump -Fc | gzip`) before running migrations. Backups are stored in `/srv/neuraal/backups/postgres/` with automatic retention (keep last 7, delete only if >14 days old). See [neuraal-deploy-rollback-backup-manual.md](neuraal-deploy-rollback-backup-manual.md) for details.

**Manual backup:**

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U neuraal neuraal -Fc | gzip > backup_$(date +%Y%m%d_%H%M%S).dump.gz

# Restore
gunzip -c backup_file.dump.gz | docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U neuraal -d neuraal --clean --if-exists
```

Recommended: Copy backups to external storage (S3, Backblaze) for disaster recovery.

### Object Storage (MinIO)

MinIO data is stored in a Docker volume (`neuraal_minio_data`). For backup:

```bash
# Using mc (MinIO Client)
mc alias set prod http://localhost:9000 ACCESS_KEY SECRET_KEY
mc mirror prod/neuraal /backup/minio/neuraal
```

### n8n Workflows

n8n data is stored in a Docker volume (`neuraal_n8n_data`). Workflow definitions are also version-controlled in `n8n/workflows/`.

---

## 9. Monitoring Production

### Health Check

```bash
curl https://neuraal.yourdomain.com/api/health
```

Returns JSON with status of: Database, Redis, Ollama, n8n, S3.

### Prometheus Metrics

```bash
curl https://neuraal.yourdomain.com/api/metrics
```

Scrape with Prometheus or Grafana Agent for dashboards and alerting.

### Sentry

Errors, performance, and session replay available in the Sentry dashboard. Configured for client, server, edge, and worker runtimes.

### Queue Monitoring

Workers expose metrics via Prometheus. For interactive monitoring during development/debugging:

```bash
pnpm monitor:queues  # Opens Bull Board UI
```

---

## 10. Operational Procedures

### Rolling Update

```bash
cd /srv/neuraal
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm app pnpm prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
```

### Rollback

Rollback happens **automatically** when a deploy fails health checks. For manual rollback:

```bash
cd /srv/neuraal
# Use the last known good tag
sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=$(cat .last_good_tag)/" .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
```

See [neuraal-deploy-rollback-backup-manual.md](neuraal-deploy-rollback-backup-manual.md) for the full rollback and database restore playbook.

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f app
```

### Database Shell

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U neuraal neuraal
```

See [runbooks.md](runbooks.md) for detailed operational procedures.
