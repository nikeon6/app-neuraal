# ADR-014: Docker Multi-Stage Build and CI/CD Pipeline

- **Status:** Accepted
- **Date:** 2026-02-12
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — production deployment and continuous delivery

---

## Context

Neuraal needs a reproducible, automated path from code commit to production deployment. The system runs on a VPS with Docker Compose and requires:

- Consistent builds across environments (dev, CI, production).
- Minimal production image size.
- Automated testing gates before deployment.
- Zero-downtime deployments where possible.

## Decision

### 1. Docker Multi-Stage Build

Use a **three-stage Dockerfile** based on `node:20-alpine`:

| Stage       | Purpose                                                    | Output            |
| ----------- | ---------------------------------------------------------- | ----------------- |
| **deps**    | Install dependencies with `pnpm install --frozen-lockfile` | `node_modules/`   |
| **build**   | Generate Prisma client, build Next.js, build workers       | `.next/`, `dist/` |
| **runtime** | Copy only production artifacts; set `NODE_ENV=production`  | Final image       |

The runtime stage includes only: `node_modules`, `.next`, `public`, `prisma`, `src/generated`, `dist` (workers), and config files. No source code, dev dependencies, or build tools.

### 2. CI Pipeline (GitHub Actions)

`ci.yml` runs on push to `main`/`develop` and on PRs:

1. **Lint & Typecheck**: ESLint + TypeScript compilation.
2. **Unit & Integration Tests**: Vitest with coverage report.
3. **E2E Tests** (Playwright): Full stack with Postgres (pgvector) + Redis services, database migrations, auth seed data, and Chromium browser.

All three stages use `pnpm v10.29.3` and `Node.js 20`.

### 3. Build & Deploy Pipeline

`build-and-deploy.yml` triggers on:

- Push to `develop` (direct deploy).
- CI workflow completion on `main` (deploy only if CI succeeds).

Steps:

1. **Build**: Docker Buildx with GitHub Actions cache (`type=gha`).
2. **Push**: Tag as `ghcr.io/{owner}/neuraal:latest` + `:{sha}` to GHCR.
3. **Deploy**: SSH to VPS, pull image, run Prisma migrations, `docker compose up -d`.

### 4. Production Compose

`docker-compose.prod.yml` defines production services:

- Postgres (pgvector:pg16) with persistent volume
- Redis 7 with AOF persistence
- MinIO for object storage
- n8n for workflow automation
- Ollama for AI inference
- App (from GHCR image)

All services have health checks and `restart: unless-stopped`.

## Consequences

### Positive

- Reproducible builds via Docker; no "works on my machine" issues.
- Automated quality gates prevent broken code from reaching production.
- E2E tests in CI catch integration issues before deploy.
- Multi-stage build keeps production image small and secure (no dev deps or source).
- GHCR provides versioned, immutable image history.

### Negative / Trade-offs

- E2E tests add ~3-5 minutes to CI pipeline.
- Docker build cache invalidation can cause slow builds on dependency changes.
- SSH-based deployment is simple but doesn't support rolling updates or canary deployments.
- VPS is a single point of failure (no auto-scaling or multi-region).

## Alternatives Considered

1. **Vercel deployment** — Considered; incompatible with BullMQ workers, Ollama, and n8n requirements.
2. **Kubernetes** — Rejected for v1; excessive complexity for a single-instance TFM project.
3. **Platform-as-a-Service (Railway/Render)** — Considered; insufficient control over Docker Compose service topology.

## References

- `Dockerfile`
- `.github/workflows/ci.yml`
- `.github/workflows/build-and-deploy.yml`
- `docker-compose.prod.yml`
