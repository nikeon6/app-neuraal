# Neuraal — Productivity App

A full-stack web application where authenticated users manage **tasks**, **notes**, and **topics** through a **calendar-driven dashboard**. Features include a **rich text editor**, **file attachments**, **AI-powered summaries**, **auto-topic classification** via embeddings, **YouTube transcription**, **OCR**, **scheduled reminders**, **sticky notes**, **weekly recap analytics**, and **cross-entry search**.

> Built as a Master's Final Project (TFM) following **Clean Architecture**, **TDD**, and production-grade security and observability practices.

**Live:** [https://neuraal.app](https://neuraal.app)

---

## Product Overview

Users can:

- **Register and log in** securely (JWT access + refresh tokens in httpOnly cookies).
- **Recover and change passwords** (email-based reset flow).
- Access a **responsive dashboard** with multiple sections (daily log, weekly recap, stickies, topics, settings).
- **Create, edit, and manage entries** (tasks and notes) with a rich text editor (TipTap).
- **Search across all entries** by title or content with a debounced search bar and keyboard navigation.
- **Organize entries** into user-defined **Topics** (color-coded categories with interactive floating bubbles).
- **Browse tasks by day** using a vertical calendar sidebar (expandable per day, with wire connections to topic bubbles).
- **Drag-and-drop reorder** tasks and stickies.
- **Attach files** to entries (images, documents via S3/MinIO presigned URLs with per-entry and per-user quotas).
- **Schedule reminders** for tasks, processed asynchronously by BullMQ workers and n8n.
- **AI features** (with per-user rate limiting, concurrency, and monthly quotas):
  - Generate **summaries** of entries asynchronously (n8n + LLM).
  - **Auto-classify** entries into topics via embedding similarity (Ollama + pgvector).
  - **Extract text from images** (OCR via Ollama vision model).
  - **Transcribe YouTube videos** embedded in entries (async via n8n).
  - Full **LLM observability** via LangSmith (tracing, prompt versioning, cost tracking) integrated through n8n.
- **Sticky notes** — persistent kanban-style notes with two-column layout.
- **Weekly recap** — analytics with completion donut chart, daily bar chart, and topic bubble chart.
- **In-app notifications** for async operations (summaries, transcriptions, reminders).
- **Settings** — view AI usage quotas and storage usage, change password.

---

## Tech Stack

| Category            | Technology                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Framework**       | Next.js 16 (App Router) + React 19 + TypeScript                                                                        |
| **Styling**         | Tailwind CSS 4                                                                                                         |
| **State**           | Zustand (with persist middleware)                                                                                      |
| **Data Fetching**   | TanStack Query (React Query)                                                                                           |
| **Rich Text**       | TipTap 3 (ProseMirror-based, custom extensions)                                                                        |
| **Animations**      | Framer Motion                                                                                                          |
| **Charts**          | Recharts, D3 (force, hierarchy)                                                                                        |
| **Icons**           | Lucide React                                                                                                           |
| **Date Handling**   | date-fns                                                                                                               |
| **Database**        | PostgreSQL 16 + pgvector (vector similarity)                                                                           |
| **ORM**             | Prisma 7 (+ raw SQL for pgvector operations)                                                                           |
| **Object Storage**  | S3-compatible (MinIO for dev, AWS S3/R2 for prod)                                                                      |
| **Job Queues**      | BullMQ + Redis 7                                                                                                       |
| **Automation**      | n8n (workflow orchestration for summaries, transcriptions, reminders)                                                  |
| **AI / Embeddings** | Ollama (`qwen3-embedding:latest` for embeddings, `glm-ocr:q8_0` for OCR/vision)                                        |
| **Auth**            | JWT (jose) + bcryptjs, httpOnly cookies with token rotation                                                            |
| **API Docs**        | OpenAPI 3.1 spec (`openapi/spec.ts`) + openapi-typescript                                                              |
| **Testing**         | Vitest + Testing Library + Playwright (E2E)                                                                            |
| **Quality**         | ESLint + SonarJS + Prettier + Commitlint + Husky                                                                       |
| **Observability**   | Sentry (errors + performance + session replay) + Prometheus metrics + pino (structured logs) + LangSmith (LLM tracing) |
| **CI/CD**           | GitHub Actions (CI + Docker build + deploy to VPS via SSH)                                                             |
| **Reverse Proxy**   | Caddy (automatic TLS)                                                                                                  |
| **Package Manager** | **pnpm** (v10+)                                                                                                        |

---

## Prerequisites

- **Node.js** 20 LTS
- **pnpm** (v10+)
- **Docker** + **Docker Compose** (for Postgres, Redis, MinIO, n8n, Ollama)

---

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts:

- **Postgres** (pgvector) — `localhost:5432`
- **Redis** — `localhost:6379`
- **MinIO** (S3) — API `localhost:9000`, Console `localhost:9001`
- **n8n** — `localhost:5678`
- **Ollama** — `localhost:11434`

Init containers auto-create the MinIO bucket and pull Ollama models.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work for local Docker setup)
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Set up database

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### 5. Start development server

```bash
pnpm dev
```

### 6. Start workers (separate terminals)

```bash
pnpm worker:reminders
pnpm worker:summaries
pnpm worker:transcriptions
```

---

## Scripts

| Script                       | Description                              |
| ---------------------------- | ---------------------------------------- |
| `pnpm dev`                   | Start Next.js dev server                 |
| `pnpm build`                 | Production build                         |
| `pnpm start`                 | Start production server                  |
| `pnpm lint`                  | Run ESLint                               |
| `pnpm format`                | Format with Prettier                     |
| `pnpm type-check`            | TypeScript type checking                 |
| `pnpm test`                  | Run tests in watch mode                  |
| `pnpm test:run`              | Run tests once (CI)                      |
| `pnpm test:coverage`         | Run tests with coverage                  |
| `pnpm test:e2e`              | Run Playwright E2E tests                 |
| `pnpm build:workers`         | Build BullMQ workers (tsup)              |
| `pnpm worker:reminders`      | Start reminders worker                   |
| `pnpm worker:summaries`      | Start summaries worker                   |
| `pnpm worker:transcriptions` | Start transcriptions worker              |
| `pnpm monitor:queues`        | Open Bull Board queue monitor UI         |
| `pnpm openapi:generate`      | Generate OpenAPI JSON + TypeScript types |
| `pnpm quality`               | Lint + typecheck + tests                 |
| `pnpm verify`                | Quality + E2E + build                    |
| `pnpm db:seed:e2e`           | Seed database for E2E tests              |

---

## Architecture

The project follows **Clean Architecture (light)** with strict layer boundaries.

### Dependency Direction

```
domain  ←  application  ←  infrastructure  ←  app/api (wiring)
```

- **Domain** has zero external dependencies.
- **Application** depends only on domain.
- **Infrastructure** implements application ports.
- **API routes** are thin wiring that connects infrastructure to application.

### Backend Layers

```
src/
  domain/
    core/                 # Result<T, E> type
    entities/             # Entry, Topic, Reminder, Notification, User, Attachment,
                          # Sticky, EntrySummaryRequest, TranscriptionRequest
    value-objects/        # Email, Password, HexColor, ISODate, EmbeddingVector,
                          # SimilarityScore, MimeType, StorageKey, Channel,
                          # JwtAccessToken, RefreshTokenValue, AiAction, QuotaLimit...

  application/
    core/                 # UseCaseError
    dto/                  # TopicDTO, EntryDTO, ReminderDTO, NotificationDTO,
                          # AttachmentDTO, StickyDTO, AuthDTO
    ports/                # Repository interfaces, EmbeddingProviderPort, QueuePort,
                          # ObjectStoragePort, AutomationPort, JwtServicePort,
                          # PasswordHasherPort, RateLimiterPort...
    use-cases/            # Auth (Register, Login, Refresh, Logout, Recover, Reset,
                          # ChangePassword), Entries (CRUD, Reorder), Topics (CRUD,
                          # RebuildEmbedding, AutoAssign), Reminders, Notifications,
                          # Stickies, Attachments (Init, Complete, Delete, Download),
                          # AI (GuardAiAction, ConsumeAiRequest, RequestSummary,
                          # RequestTranscription, ExtractImageText)
    test/                 # InMemory repos, Fake ports (test doubles)

  infrastructure/
    auth/                 # JoseJwtService, BcryptPasswordHasher, AuthCookies,
                          # CryptoRefreshTokenService, LoginRateLimiter, AuthConfig
    automation/           # N8NClient (HMAC-signed webhooks)
    config/               # AiGuardrailsConfig, AttachmentConfig
    embedding/            # OllamaEmbeddingProvider
    http/                 # withApiContext, requestContext (request ID, logging)
    logging/              # pino logger (structured JSON, auto-redaction)
    metrics/              # Prometheus counters and histograms
    ocr/                  # OllamaVisionProvider
    persistence/          # Prisma client, PrismaXxxRepository (13 repositories)
    queue/                # BullMQAdapter, reminderWorker, summaryWorker,
                          # transcriptionWorker, bullBoardServer
    redis/                # RedisClient, RedisRateLimiter, RedisConcurrencyLimiter
    storage/              # S3ObjectStorage (presigned URLs)

  app/api/                # Next.js API routes (thin wiring layer)
```

### Frontend Layers (Feature-Based)

```
src/
  shared/
    api/                  # Centralized API client, TanStack Query hooks, OpenAPI types
    types/                # Shared frontend types
    lib/                  # Utilities (cn, extractPlainText, topics...)
    constants/            # Embedding config, business rules
    store/                # Global Zustand store (UI state only; server data via TanStack Query)
    hooks/                # useEntries, useTopics
    ui/                   # ConfirmDialog, MinimalTiptapEditor

  features/
    dashboard/            # Main dashboard with section navigation, search bar
    calendar/             # Vertical calendar sidebar
    tasks-container/      # Drag-and-drop task list (Framer Motion Reorder)
    task-editor/          # TipTap rich text editor with custom extensions
    topics/               # Floating topic bubbles (D3 force), TopicsSection CRUD
    stickies/             # Kanban-style sticky notes
    weekly-recap/         # Analytics charts (Recharts, D3)
    notifications/        # In-app notification center
    attachments/          # File attachment panel
    settings/             # AI usage, storage usage, change password
    layout/               # Auth-protected main layout
```

### Other Project Files

```
openapi/
  spec.ts               # OpenAPI 3.1 source of truth
  openapi.json          # Generated (pnpm openapi:emit)
scripts/
  openapi/emit.ts       # Spec -> JSON emitter
prisma/
  schema.prisma         # Database schema (13 models)
  migrations/           # Prisma migrations
docs/
  design.md             # Software Design Document
  security.md           # Security documentation
  deployment.md         # Deployment and CI/CD guide
  observability.md      # Logging, Sentry, Prometheus, healthcheck
  runbooks.md           # Operational runbooks
  ci.md                 # CI pipeline details
  neuraal-deploy-rollback-backup-manual.md  # Deploy, rollback & backup manual
  adr/                  # Architecture Decision Records (16 ADRs)
  context/              # AI/developer context docs
n8n/
  workflows/            # n8n workflow definitions (JSON)
```

### Import Rules

- `domain/` imports from `domain/` only
- `application/` imports from `domain/` and `application/` only
- `infrastructure/` imports from `application/` + `domain/`
- `shared/` imports from `shared/` only
- `features/X/` imports from `shared/` and `features/X/` only
- **Never** cross-import between features

---

## API Endpoints

The project exposes a RESTful API documented via OpenAPI 3.1 at `/api/openapi.json`.

### Authentication

| Method | Path                        | Description                     |
| ------ | --------------------------- | ------------------------------- |
| POST   | `/api/auth/register`        | Register new user               |
| POST   | `/api/auth/login`           | Login (rate-limited)            |
| POST   | `/api/auth/refresh`         | Rotate tokens                   |
| POST   | `/api/auth/logout`          | Revoke tokens                   |
| GET    | `/api/auth/me`              | Current user profile            |
| POST   | `/api/auth/recover`         | Request password reset          |
| POST   | `/api/auth/reset-password`  | Confirm password reset          |
| POST   | `/api/auth/change-password` | Change password (authenticated) |

### Entries

| Method | Path                                   | Description                           |
| ------ | -------------------------------------- | ------------------------------------- |
| GET    | `/api/entries?date=YYYY-MM-DD`         | List entries by date                  |
| POST   | `/api/entries`                         | Create entry                          |
| PATCH  | `/api/entries/{id}`                    | Update entry (optimistic concurrency) |
| DELETE | `/api/entries/{id}`                    | Delete entry                          |
| PATCH  | `/api/entries/reorder`                 | Bulk reorder entries                  |
| POST   | `/api/entries/{id}/summarize`          | Request AI summary (202)              |
| GET    | `/api/entries/{id}/summary`            | Get entry summary                     |
| POST   | `/api/entries/{id}/transcribe-youtube` | Request transcription (202)           |
| GET    | `/api/entries/{id}/transcription`      | Get transcription                     |
| POST   | `/api/entries/{id}/ocr`                | Extract text from image (sync)        |
| POST   | `/api/entries/{id}/auto-topic`         | Auto-classify into topic              |
| GET    | `/api/entries/{id}/attachments`        | List attachments                      |

### Topics

| Method | Path                                 | Description             |
| ------ | ------------------------------------ | ----------------------- |
| GET    | `/api/topics`                        | List user topics        |
| POST   | `/api/topics`                        | Create topic            |
| PATCH  | `/api/topics/{id}`                   | Update topic            |
| DELETE | `/api/topics/{id}`                   | Delete topic            |
| POST   | `/api/topics/{id}/embedding/rebuild` | Rebuild topic embedding |

### Stickies

| Method | Path                    | Description           |
| ------ | ----------------------- | --------------------- |
| GET    | `/api/stickies`         | List stickies         |
| POST   | `/api/stickies`         | Create sticky         |
| PATCH  | `/api/stickies/{id}`    | Update sticky         |
| DELETE | `/api/stickies/{id}`    | Delete sticky         |
| PATCH  | `/api/stickies/reorder` | Bulk reorder stickies |

### Reminders

| Method | Path                         | Description            |
| ------ | ---------------------------- | ---------------------- |
| GET    | `/api/reminders?entryId=...` | List pending reminders |
| POST   | `/api/reminders`             | Create reminder        |
| PATCH  | `/api/reminders/{id}`        | Update/cancel reminder |

### Notifications

| Method | Path                           | Description        |
| ------ | ------------------------------ | ------------------ |
| GET    | `/api/notifications?since=...` | List notifications |
| POST   | `/api/notifications/{id}/read` | Mark as read       |

### Attachments

| Method | Path                             | Description                           |
| ------ | -------------------------------- | ------------------------------------- |
| POST   | `/api/attachments/init`          | Initialize upload (presigned PUT URL) |
| POST   | `/api/attachments/complete`      | Confirm upload complete               |
| DELETE | `/api/attachments/{id}`          | Delete attachment                     |
| GET    | `/api/attachments/{id}/download` | Presigned download URL                |

### AI & Storage

| Method | Path                                 | Description              |
| ------ | ------------------------------------ | ------------------------ |
| GET    | `/api/ai/usage?action=...&month=...` | AI usage and limits      |
| GET    | `/api/storage/usage`                 | Storage usage and quotas |

### Automation Callbacks (HMAC-authenticated)

| Method | Path                                            | Description                   |
| ------ | ----------------------------------------------- | ----------------------------- |
| POST   | `/api/automations/entry-summary/callback`       | Summary result from n8n       |
| POST   | `/api/automations/entry-transcript/callback`    | Transcript result from n8n    |
| POST   | `/api/automations/entry-transcription/callback` | Transcription result from n8n |

### System

| Method | Path                | Description                               |
| ------ | ------------------- | ----------------------------------------- |
| GET    | `/api/health`       | Health check (DB, Redis, Ollama, n8n, S3) |
| GET    | `/api/metrics`      | Prometheus metrics                        |
| GET    | `/api/openapi.json` | OpenAPI specification                     |

---

## Authentication

JWT-based authentication with access + refresh tokens stored in httpOnly cookies.

- **Access token**: Short-lived (default 15 min), HS256 signed with `jose`.
- **Refresh token**: Long-lived (default 30 days), stored hashed (SHA-256) in database.
- **Token rotation**: New refresh token issued on each refresh; old token revoked.
- **Reuse detection**: If a revoked token is reused, all user tokens are revoked.
- **Password policy**: 8+ characters with uppercase, lowercase, number, and special character. Bcrypt with 12 rounds.
- **Login rate limiting**: 5 failed attempts per IP triggers a 5-minute lockout.
- **Dev fallback**: In non-production, an `x-user-id` header is accepted if no JWT cookie is present.

See [docs/security.md](docs/security.md) for the complete security documentation.

---

## Testing

### Test Stack

| Tool                | Purpose                                     |
| ------------------- | ------------------------------------------- |
| **Vitest**          | Unit and integration tests (157 test files) |
| **Testing Library** | React component tests (behavior-focused)    |
| **Playwright**      | E2E tests (auth flows, dashboard, health)   |
| **jsdom**           | Browser environment for component tests     |

### Test Layers

- **Domain**: Value objects, entities, pure business rules
- **Application**: Use cases with in-memory test doubles (fake repos, fake ports)
- **API**: Route handler tests with mocked use cases
- **Component**: React components with Testing Library
- **E2E**: Critical user flows with Playwright (Chromium)

### Coverage Strategy

Risk-based thresholds instead of blind global percentage gates:

- **100%**: Critical guardrails (`GuardAiAction`, `ConsumeAiRequest`)
- **80%+**: User-facing routes (auth, entries, reminders) and key components
- **0%**: Type definitions, constants, generated code

### Commands

```bash
pnpm test            # Watch mode
pnpm test:run        # Single run (CI)
pnpm test:coverage   # With coverage report
pnpm test:e2e        # Playwright E2E
```

---

## CI/CD Pipeline

### Continuous Integration (`ci.yml`)

Runs on push to `main`/`develop` and on PRs:

1. **Lint & Typecheck**: ESLint + TypeScript compilation.
2. **Unit & Integration Tests**: Vitest with coverage report.
3. **E2E Tests**: Playwright with Chromium against Postgres (pgvector) + Redis services, database migrations, and auth seed data.

### Build & Deploy (`build-and-deploy.yml`)

Triggered by push to `develop` or CI completion on `main`:

1. **Wait for CI** — deploy only proceeds if CI passes.
2. **Build** — Docker multi-stage build (deps → build → runtime) with GitHub Actions cache (`type=gha`).
3. **Push** — Tagged image pushed to GHCR (`ghcr.io/{owner}/neuraal:latest` + `:{sha}`).
4. **Deploy via SSH** to VPS with the following safety steps:

### Deploy Safety: Automatic Backup & Rollback

Every deployment includes built-in safety mechanisms:

```
┌─────────────────────────────────────────────────┐
│  1. Save current tag as rollback reference       │
│  2. PostgreSQL backup (pg_dump → gzip)           │
│  3. Backup retention (keep 7, delete >14 days)   │
│  4. Pull new image from GHCR                     │
│  5. Run Prisma migrations                        │
│     └─ On failure → rollback to previous tag     │
│  6. Start services (docker compose up)           │
│  7. Health check (up to 10 min, /api/health)     │
│     ├─ On success → save as .last_good_tag       │
│     └─ On failure → automatic rollback           │
│        ├─ Revert to .last_good_tag               │
│        ├─ Pull + restart old image               │
│        └─ Re-check health                        │
└─────────────────────────────────────────────────┘
```

- **Pre-migration DB backup**: `pg_dump` compressed with gzip before every deploy.
- **Backup retention**: Keeps the last 7 backups; deletes older ones only if >14 days old.
- **Automatic rollback on migration failure**: Reverts `APP_IMAGE_TAG` to previous tag and restarts.
- **Automatic rollback on health failure**: If `/api/health` doesn't respond within timeout, rolls back to `.last_good_tag`.
- **Manual recovery**: Documented in [docs/neuraal-deploy-rollback-backup-manual.md](docs/neuraal-deploy-rollback-backup-manual.md).

### Production Stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Services: Postgres (pgvector), Redis (with persistence), MinIO, n8n, Ollama, Caddy (reverse proxy + automatic TLS), App.

See [docs/deployment.md](docs/deployment.md) for the complete deployment guide.

---

## Environment Variables

See `.env.example` for the full list with documentation. Key groups:

| Group        | Variables                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Database** | `DATABASE_URL`                                                                                                      |
| **Redis**    | `REDIS_URL`                                                                                                         |
| **S3/MinIO** | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                                 |
| **Auth**     | `AUTH_JWT_SECRET`, `AUTH_ACCESS_TTL_SECONDS`, `AUTH_REFRESH_TTL_DAYS`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE` |
| **n8n**      | `N8N_BASE_URL`, `N8N_*_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`                                                           |
| **Ollama**   | `OLLAMA_BASE_URL`, `OLLAMA_EMBED_MODEL`, `EMBEDDING_DIM`, `AUTO_TOPIC_THRESHOLD`                                    |
| **Sentry**   | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`                           |
| **App**      | `APP_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`                                                                          |

**Never commit `.env` files** with real secrets.

---

## Docker Compose Services

| Service  | Image                    | Port      | Purpose                               |
| -------- | ------------------------ | --------- | ------------------------------------- |
| postgres | `pgvector/pgvector:pg16` | 5432      | Database with vector support          |
| redis    | `redis:7-alpine`         | 6379      | BullMQ job queues + rate limiting     |
| minio    | `minio/minio`            | 9000/9001 | S3-compatible object storage          |
| n8n      | `n8nio/n8n`              | 5678      | Workflow automation                   |
| ollama   | `ollama/ollama`          | 11434     | Local LLM inference (embeddings, OCR) |

---

## Observability

- **Sentry**: Error tracking, performance monitoring, and session replay (client/server/edge/workers).
- **Prometheus**: HTTP request metrics, AI guardrail metrics, BullMQ job metrics at `/api/metrics`.
- **Structured Logging**: pino with JSON output, auto-redaction of sensitive fields, request ID propagation.
- **LangSmith**: LLM observability integrated through n8n — traces every AI Agent execution (summaries, transcriptions) with full input/output logging, latency breakdown, token usage, cost tracking, and prompt versioning. Enables iterating on system prompts with version history and A/B comparison without redeploying workflows.
- **Health Check**: `/api/health` reports status of all critical dependencies (DB, Redis, Ollama, n8n, S3).
- **Bull Board**: Queue monitoring UI via `pnpm monitor:queues`.

See [docs/observability.md](docs/observability.md) for full details.

---

## Architecture Decision Records

| ADR                                                                        | Decision                                            | Status     |
| -------------------------------------------------------------------------- | --------------------------------------------------- | ---------- |
| [001](docs/adr/adr-001-nextjs-app-router-and-feature-structure.md)         | Next.js App Router + feature-based structure        | Accepted   |
| [002](docs/adr/adr-002-state-management-feature-scoped-first.md)           | Feature-scoped state management + Zustand           | Accepted   |
| [003](docs/adr/adr-003-testing-stack-vitest-testing-library-playwright.md) | Testing: Vitest + Testing Library + Playwright      | Accepted   |
| [004](docs/adr/adr-004-auth-access-refresh-httpOnly-cookies.md)            | Auth: JWT access/refresh tokens in httpOnly cookies | Accepted   |
| [005](docs/adr/adr-005-observability-sentry.md)                            | Observability with Sentry                           | Accepted   |
| [006](docs/adr/adr-006-auth-oauth-authjs-postgres-sessions.md)             | Auth: OAuth + Auth.js (superseded by ADR-004)       | Superseded |
| [007](docs/adr/adr-007-hybrid-persistence-postgres-s3-compatible.md)       | Hybrid persistence: Postgres + S3                   | Accepted   |
| [008](docs/adr/adr-008-automation-n8n-orchestrated-async-jobs.md)          | Automation: n8n + BullMQ async jobs                 | Accepted   |
| [009](docs/adr/adr-009-pgvector-embeddings-auto-topic.md)                  | pgvector embeddings for auto-topic classification   | Accepted   |
| [010](docs/adr/adr-010-openapi-spec-generated-types.md)                    | OpenAPI spec as source of truth + generated types   | Accepted   |
| [011](docs/adr/adr-011-ai-guardrails-usage-tracking.md)                    | AI guardrails and usage tracking                    | Accepted   |
| [012](docs/adr/adr-012-rich-text-editor-tiptap.md)                         | Rich text editor: TipTap 3                          | Accepted   |
| [013](docs/adr/adr-013-whatsapp-integration-evolution-api.md)              | WhatsApp reminders via Evolution API                | Deprecated |
| [014](docs/adr/adr-014-docker-multistage-cicd-pipeline.md)                 | Docker multi-stage build + CI/CD pipeline           | Accepted   |
| [015](docs/adr/adr-015-structured-logging-prometheus-metrics.md)           | Structured logging (pino) + Prometheus metrics      | Accepted   |
| [016](docs/adr/adr-016-tanstack-query-server-state.md)                     | TanStack Query for server state management          | Accepted   |

---

## Documentation

| Document                                                                                       | Description                                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [docs/design.md](docs/design.md)                                                               | Software Design Document (architecture, domain model, flows) |
| [docs/security.md](docs/security.md)                                                           | Security: auth, rate limiting, HMAC, headers, OWASP          |
| [docs/deployment.md](docs/deployment.md)                                                       | Deployment: Docker, CI/CD, VPS, production config            |
| [docs/neuraal-deploy-rollback-backup-manual.md](docs/neuraal-deploy-rollback-backup-manual.md) | Deploy, automatic rollback & PostgreSQL backup manual        |
| [docs/observability.md](docs/observability.md)                                                 | Logging, Sentry, Prometheus, health checks                   |
| [docs/runbooks.md](docs/runbooks.md)                                                           | Operational runbooks for common scenarios                    |
| [docs/ci.md](docs/ci.md)                                                                       | CI pipeline configuration details                            |
| [docs/n8n-transcription-workflow.md](docs/n8n-transcription-workflow.md)                       | n8n YouTube transcription workflow                           |
| [docs/context/project-context.md](docs/context/project-context.md)                             | Full project context for AI assistants                       |
| [docs/context/backend-plan.md](docs/context/backend-plan.md)                                   | Original backend design plan (with implementation notes)     |
| [docs/adr/](docs/adr/)                                                                         | Architecture Decision Records (16 ADRs)                      |

---

## License

TBD
