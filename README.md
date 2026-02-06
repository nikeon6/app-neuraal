# Neuraal — Calendar Tasks & Notes (Next.js)

A web application where authenticated users can manage **tasks**, **notes**, and **topics** through a **calendar-driven dashboard**, including **reminders**, **AI-powered summaries**, and **auto-topic classification** via embeddings.

> Key requirement: **responsive UI** (desktop and mobile) from day one.

---

## Product Overview

Users can:
- Sign up / log in securely (JWT planned; currently using dev `x-user-id` header).
- Access a dashboard with a summary view.
- Create, edit, and manage **entries** (tasks and notes).
- Organize entries into user-defined **Topics** (color-coded categories).
- Browse tasks by day using a **right-side day list** (expandable per day).
- Attach files to entries (images, documents via S3/MinIO presigned URLs).
- Schedule **reminders** for tasks (processed by BullMQ workers + n8n).
- **AI features**:
  - Generate **summaries** of entries asynchronously (n8n + LLM).
  - **Auto-classify** entries into topics via embedding similarity (Ollama + pgvector).
- Receive **in-app notifications** for async operations (reminders, summaries).

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 19 + Next.js 16 + TypeScript (App Router) |
| **Styling** | Tailwind CSS 4 |
| **State** | Zustand (with persist middleware) |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Date Handling** | date-fns |
| **Database** | PostgreSQL 16 + pgvector (vector similarity) |
| **ORM** | Prisma 7 (+ raw SQL for pgvector) |
| **Object Storage** | S3-compatible (MinIO for dev, AWS S3/R2 for prod) |
| **Job Queues** | BullMQ + Redis 7 |
| **Automation** | n8n (workflow orchestration for summaries, reminders) |
| **AI / Embeddings** | Ollama (nomic-embed-text-v2-moe, glm-ocr) |
| **API Docs** | OpenAPI 3.1 spec (`openapi/spec.ts`) + openapi-typescript |
| **Testing** | Vitest + Testing Library + jsdom (Playwright planned for E2E) |
| **Quality** | ESLint + SonarJS + jsx-a11y + Prettier |
| **Observability** | Sentry (planned) |
| **Package Manager** | **pnpm only** |

---

## Prerequisites

- **Node.js** (LTS recommended)
- **pnpm** (v9+)
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
- **n8n** — `localhost:5678` (user: `neuraal`, pass: `neuraal_password`)
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

### 6. (Optional) Start workers

```bash
# In separate terminals:
pnpm worker:reminders
pnpm worker:summaries
```

---

## Scripts

| Script | Description |
|--------|-----------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |
| `pnpm type-check` | TypeScript type checking |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once (CI) |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm worker:reminders` | Start reminders BullMQ worker |
| `pnpm worker:summaries` | Start summaries BullMQ worker |
| `pnpm openapi:emit` | Generate `openapi/openapi.json` from `openapi/spec.ts` |
| `pnpm openapi:types` | Generate `src/shared/api/openapi-types.ts` from JSON |
| `pnpm openapi:generate` | Both: emit + types |

---

## Verify Infrastructure

```bash
# Postgres with pgvector
docker exec -it neuraal-postgres psql -U neuraal -d neuraal \
  -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"

# Redis
docker exec -it neuraal-redis redis-cli ping

# Ollama models
curl http://localhost:11434/api/tags

# MinIO bucket
docker exec -it neuraal-minio mc ls local/neuraal

# n8n health
curl http://localhost:5678/healthz
```

---

## Architecture

The project follows **Clean Architecture (light)** with strict layer boundaries.

### Backend Layers

```
src/
  domain/                 # Pure domain — zero external deps
    core/                 # Result type
    entities/             # Entry, Topic, Reminder, Notification, EntrySummaryRequest
    value-objects/        # HexColor, ISODate, EmbeddingVector, SimilarityScore, EmbeddingModelName

  application/            # Use cases + ports — depends on domain only
    core/                 # UseCaseError
    dto/                  # TopicDTO, ReminderDTO, NotificationDTO, AttachmentDTO
    ports/                # Interfaces: TopicRepository, EntryRepository, EmbeddingProviderPort, QueuePort...
    use-cases/            # CreateEntry, CreateTopic, AutoAssignTopicToEntry, RebuildTopicEmbedding...
    test/                 # InMemory repos, FakeEmbeddingProvider (test doubles)

  infrastructure/         # Concrete implementations — depends on application + domain
    auth/                 # getAuthUserId (x-user-id → future JWT)
    automation/           # N8NClient (webhook triggers, HMAC signing)
    config/               # AttachmentConfig
    embedding/            # OllamaEmbeddingProvider
    persistence/          # Prisma client, PrismaXxxRepository (raw SQL for pgvector)
    queue/                # BullMQAdapter, reminderWorker, summaryWorker
    storage/              # S3ObjectStorage

  app/api/                # Next.js API routes — thin wiring layer
    topics/               # CRUD + embedding rebuild
    entries/              # CRUD + summarize + auto-topic + attachments
    reminders/            # Create + update
    notifications/        # List + mark-read
    automations/          # HMAC-signed callbacks (n8n → app)
    openapi.json/         # Serves OpenAPI spec at runtime
```

### Frontend Layers (Feature-Based)

```
src/
  shared/                 # Global scope — available across the entire app
    api/                  # Centralized API client (apiFetch, helpers, OpenAPI types)
    types/                # Shared frontend types
    lib/                  # Utilities (cn, uid, clamp, extractPlainText...)
    constants/            # Business constants (embedding config, topics, days...)
    store/                # Global Zustand store
    hooks/                # Reusable custom hooks
    ui/                   # Reusable UI components

  features/               # Local scope — feature-specific code
    dashboard/            # Main dashboard
    calendar/             # Calendar sidebar
    tasks-container/      # Task list container
    task-editor/          # Rich entry editor
    topics/               # Floating topic bubbles
    layout/               # App layout with auth protection
```

### Other files

```
openapi/
  spec.ts               # OpenAPI 3.1 source of truth
  openapi.json          # Generated (pnpm openapi:emit)
scripts/
  openapi/emit.ts       # Spec → JSON emitter
prisma/
  schema.prisma         # Database schema
  migrations/           # Prisma migrations
docs/
  adr/                  # Architecture Decision Records
  design.md             # Design notes
```

### Dependency direction

```
domain  ←  application  ←  infrastructure  ←  app/api (wiring)
  ↑                                              |
  └──────── no reverse dependencies ─────────────┘
```

### Import rules

- `domain/` → imports from `domain/` only
- `application/` → imports from `domain/` and `application/` only
- `infrastructure/` → imports from `application/` + `domain/`
- `shared/` → imports from `shared/` only
- `features/X/` → imports from `shared/` and `features/X/` only
- **Never** cross-import between features

---

## API Documentation (OpenAPI)

The project has a single-source OpenAPI 3.1 spec in `openapi/spec.ts`.

```bash
# Regenerate JSON + TypeScript types
pnpm openapi:generate

# Or inspect at runtime
curl http://localhost:3000/api/openapi.json
```

### Documented endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/topics` | List user topics |
| POST | `/api/topics` | Create topic |
| PATCH | `/api/topics/{id}` | Update topic |
| DELETE | `/api/topics/{id}` | Delete topic |
| POST | `/api/topics/{id}/embedding/rebuild` | Rebuild topic embedding |
| GET | `/api/entries?date=YYYY-MM-DD` | List entries by date |
| POST | `/api/entries` | Create entry |
| PATCH | `/api/entries/{id}` | Update entry |
| POST | `/api/entries/{id}/summarize` | Request async summary (202) |
| POST | `/api/entries/{id}/auto-topic` | Auto-classify entry into topic |
| POST | `/api/entries/{id}/attachments/presigned-url` | Get presigned upload URL |
| DELETE | `/api/entries/{id}/attachments/{attachmentId}` | Delete attachment |
| POST | `/api/reminders` | Create reminder |
| PATCH | `/api/reminders/{id}` | Update reminder |
| GET | `/api/notifications` | List notifications |
| POST | `/api/notifications/{id}/read` | Mark notification as read |
| POST | `/api/automations/entry-summary/callback` | HMAC-signed callback from n8n |
| GET | `/api/openapi.json` | OpenAPI spec (no auth) |

---

## Environment Variables

See `.env.example` for the full list with documentation. Key groups:

| Group | Variables |
|-------|----------|
| **Database** | `DATABASE_URL` |
| **Redis** | `REDIS_URL` |
| **S3/MinIO** | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| **n8n** | `N8N_BASE_URL`, `N8N_*_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` |
| **Ollama** | `OLLAMA_BASE_URL`, `OLLAMA_EMBED_MODEL`, `EMBEDDING_DIM`, `AUTO_TOPIC_THRESHOLD` |
| **App** | `APP_BASE_URL` |
| **Frontend** | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_DEV_USER_ID` |

**Never commit `.env` files** with real secrets.

---

## Testing

### Test Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Fast test runner with native TypeScript support |
| **Testing Library** | React testing utilities (behavior-focused) |
| **jsdom** | DOM environment for component tests |
| **@testing-library/jest-dom** | Custom matchers for DOM assertions |

### Test Layers

- **Domain**: Value objects, entities, pure functions
- **Application**: Use cases with in-memory test doubles
- **Infrastructure**: Repository implementations (Prisma, Ollama, S3)
- **API**: Route handler integration tests
- **Component**: React components with Testing Library

### TDD Workflow

1. **Red**: Write a failing test
2. **Green**: Write the minimum code to pass
3. **Refactor**: Improve while keeping tests green

---

## Authentication

### Current state (development)

Temporary `x-user-id` header sent from the API client:
- Controlled by `NEXT_PUBLIC_DEV_USER_ID` env var
- Not sent in production (`NODE_ENV=production`)
- HMAC-signed callbacks do NOT use this header

### Target state (future)

JWT-based auth with access + refresh tokens in httpOnly cookies. See `docs/adr/adr-004-auth-access-refresh-httpOnly-cookies.md`.

---

## Architecture Decision Records

| ADR | Decision |
|-----|----------|
| [001](docs/adr/adr-001-nextjs-app-router-and-feature-structure.md) | Next.js App Router + feature-based structure |
| [002](docs/adr/adr-002-state-management-feature-scoped-first.md) | Feature-scoped state management |
| [003](docs/adr/adr-003-testing-stack-vitest-testing-library-playwright.md) | Testing stack: Vitest + Testing Library + Playwright |
| [004](docs/adr/adr-004-auth-access-refresh-httpOnly-cookies.md) | Auth: access + refresh tokens in httpOnly cookies |
| [005](docs/adr/adr-005-observability-sentry.md) | Observability with Sentry |
| [006](docs/adr/adr-006-auth-oauth-authjs-postgres-sessions.md) | Auth: OAuth + Auth.js + Postgres sessions |
| [007](docs/adr/adr-007-hybrid-persistence-postgres-s3-compatible.md) | Hybrid persistence: Postgres + S3 |
| [008](docs/adr/adr-008-automation-n8n-orchestrated-async-jobs.md) | Automation: n8n + BullMQ async jobs |
| [009](docs/adr/adr-009-pgvector-embeddings-auto-topic.md) | pgvector embeddings for auto-topic classification |
| [010](docs/adr/adr-010-openapi-spec-generated-types.md) | OpenAPI spec as source of truth + generated types |

---

## Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | `pgvector/pgvector:pg16` | 5432 | Database with vector support |
| redis | `redis:7-alpine` | 6379 | BullMQ job queues |
| minio | `minio/minio` | 9000/9001 | S3-compatible object storage |
| n8n | `n8nio/n8n` | 5678 | Workflow automation |
| ollama | `ollama/ollama` | 11434 | Local LLM inference (embeddings, OCR) |

---

## License

TBD
