---

## `agents.md`

```md
# AI Working Agreement — Project Rules & Constraints

This file defines **non-negotiable rules** for AI-assisted development in this repository.
If anything is ambiguous, **ASK QUESTIONS FIRST**. Do not guess.

---

## 0) Prime Directive

**When in doubt, ask.**
The project owner prefers answering questions over receiving unwanted assumptions.

---

## 1) Non-Negotiables

### Language

- All **code** and **code comments** must be written in **English**.
- All **git commit messages** must be written in **English**.
- Documentation (Markdown) can be Spanish or English, but keep it clear and consistent.

### Package Manager

- Use **pnpm exclusively**.
  - ✅ `pnpm install`
  - ✅ `pnpm run dev`
  - ✅ `pnpm test`
  - ❌ `npm`, `yarn`, `bun`

### Architecture

- Follow **Clean Architecture (light)** and enforce boundaries.
- Do not introduce cross-layer imports that break dependency direction.
- Prefer explicit interfaces/ports for infrastructure dependencies.

### Security by Design

- Treat security as a default requirement.
- Follow OWASP Top 10 mindset:
  - access control is enforced on the server
  - validate input at boundaries
  - avoid injection risks
  - protect auth flows
  - log/monitor meaningful security events without leaking secrets

### Responsive UI

- Every UI feature must be **responsive** (desktop + mobile).
- Avoid "desktop-only" layouts.

### Quality Gate

- Keep ESLint/Prettier/a11y rules passing.
- Add/update tests for core behaviors.
- Do not introduce new libraries without justification and approval.

---

## 2) Project Goals (Product)

Build an app where authenticated users can:

- **Register, log in, recover/reset/change password** (JWT access + refresh tokens in httpOnly cookies).
- Access a **dashboard** with multiple sections (daily log, weekly recap, stickies, topics, settings).
- Create/edit tasks and notes (**entries**) with a **rich text editor** (TipTap).
- Organize entries into user-defined **Topics** (color-coded categories).
- Navigate tasks by day via a **right-side day list** (expandable).
- **Drag-and-drop reorder** tasks and stickies.
- Attach files to entries (S3/MinIO presigned URL flow with per-entry and per-user quotas).
- Create **sticky notes** (kanban-style, two-column layout).
- View **weekly recap** analytics (completion chart, daily bar chart, topic bubble chart).
- Schedule task **reminders** processed asynchronously (BullMQ/Redis worker + n8n).
- **AI features** (with per-user rate limiting, concurrency limits, and monthly quotas):
  - Generate **summaries** of entries asynchronously (n8n + LLM).
  - **Auto-classify** entries into topics via embedding similarity (Ollama + pgvector).
  - **Extract text from images** (OCR via Ollama vision model).
  - **Transcribe YouTube videos** embedded in entries (async via n8n).
- Receive **in-app notifications** for async operations (reminders, summaries, transcriptions).
- View **AI usage quotas** and **storage usage** in settings.

---

## 3) Clean Architecture Boundaries (Practical Rules)

### Dependency direction

- `domain` must not depend on `application` or `infrastructure`.
- `application` can depend on `domain`, but not on concrete infrastructure.
- `infrastructure` depends on `application` + `domain` and provides implementations.

### Backend Layers (Clean Architecture)

The backend follows strict Clean Architecture with these layers:

| Layer              | Location              | Depends on                   | Contains                                           |
| ------------------ | --------------------- | ---------------------------- | -------------------------------------------------- |
| **Domain**         | `src/domain/`         | Nothing                      | Entities, Value Objects, core Result type          |
| **Application**    | `src/application/`    | Domain only                  | Use cases, ports (interfaces), DTOs, test doubles  |
| **Infrastructure** | `src/infrastructure/` | Application + Domain         | Prisma repos, BullMQ, Ollama, n8n client, S3, auth |
| **API (thin)**     | `src/app/api/`        | Infrastructure + Application | Next.js route handlers (wiring only)               |

**Backend folder structure:**

```
src/
  domain/
    core/             # Result type
    entities/         # Entry, Topic, Reminder, Notification, User, Attachment,
                      # Sticky, EntrySummaryRequest, TranscriptionRequest
    value-objects/    # Email, Password, HexColor, ISODate, EmbeddingVector,
                      # SimilarityScore, MimeType, StorageKey, Channel,
                      # JwtAccessToken, RefreshTokenValue, AiAction, QuotaLimit...
  application/
    core/             # UseCaseError
    dto/              # AuthDTO, EntryDTO, TopicDTO, ReminderDTO, NotificationDTO,
                      # AttachmentDTO, StickyDTO
    ports/            # Repository interfaces, EmbeddingProviderPort, QueuePort,
                      # JwtServicePort, PasswordHasherPort, RateLimiterPort...
    use-cases/        # Auth (Register, Login, Refresh, Logout, Recover, Reset,
                      # ChangePassword), Entries CRUD, Topics CRUD + Embedding,
                      # Reminders, Notifications, Stickies, Attachments,
                      # AI (GuardAiAction, ConsumeAiRequest, Summary, Transcription, OCR)
    test/             # InMemory repos, Fake ports (test doubles)
  infrastructure/
    auth/             # JoseJwtService, BcryptPasswordHasher, AuthCookies,
                      # CryptoRefreshTokenService, LoginRateLimiter, AuthConfig
    automation/       # N8NClient (HMAC-signed webhooks)
    config/           # AiGuardrailsConfig, AttachmentConfig
    embedding/        # OllamaEmbeddingProvider
    http/             # withApiContext, requestContext (request ID, logging)
    logging/          # pino logger (structured JSON, auto-redaction)
    metrics/          # Prometheus counters and histograms
    ocr/              # OllamaVisionProvider
    persistence/      # Prisma client, PrismaXxxRepository (13 repositories)
    queue/            # BullMQAdapter, reminderWorker, summaryWorker,
                      # transcriptionWorker, bullBoardServer
    redis/            # RedisClient, RedisRateLimiter, RedisConcurrencyLimiter
    storage/          # S3ObjectStorage (presigned URLs)
  app/api/            # Next.js API route handlers (thin wiring layer)
```

### Frontend Layers (Feature-Based)

The frontend uses a **feature-based architecture** with clear scopes:

| Scope      | Location          | Visibility     | Contains                                              |
| ---------- | ----------------- | -------------- | ----------------------------------------------------- |
| **Global** | `src/shared/`     | Entire app     | Types, utils, constants, store, hooks, UI, API client |
| **Local**  | `src/features/X/` | Only feature X | Feature-specific components/logic                     |

**Frontend folder structure:**

```
src/
  shared/
    api/            # Centralized API client (apiFetch, helpers, OpenAPI types)
    types/          # Shared frontend types
    lib/            # Utilities (cn, uid, clamp, extractPlainText...)
    constants/      # Business rules (TOPICS, DAYS, embedding config...)
    store/          # Global Zustand store
    hooks/          # Reusable custom hooks
    ui/             # Reusable UI components
  features/
    dashboard/
    calendar/
    tasks-container/
    task-editor/
    topics/
    stickies/
    weekly-recap/
    notifications/
    attachments/
    settings/
    layout/
```

### Import rules

**Backend:**

- `domain/` → imports from `domain/` only (zero external deps)
- `application/` → imports from `domain/` and `application/` only
- `infrastructure/` → imports from `application/` + `domain/`
- `app/api/` → imports from `infrastructure/` + `application/` (wiring)

**Frontend:**

- `shared/` → can import from `shared/` only
- `features/X/` → can import from `shared/` and `features/X/` only
- **Never** import across features (`features/A/` → `features/B/`)
- Use barrel exports (`index.ts`) for cleaner imports

### Other project files

```
docs/
  adr/                # Architecture Decision Records
  design.md           # Design notes
  context/            # AI/developer context docs
    project-context.md
    backend-plan.md
    requirements-gathering.txt
  templates/          # PR description references
    pr-description-dashboard.md
    pr-description-topics.md
  reference-material/ # Supporting PDFs/reference docs
    documentacion/
openapi/
  spec.ts           # OpenAPI 3.1 source of truth
  openapi.json      # Generated JSON (pnpm openapi:emit)
scripts/
  openapi/emit.ts   # Script to generate openapi.json
prisma/
  schema.prisma     # DB schema (+ pgvector via raw SQL)
  migrations/       # Prisma migrations
```

### Configuration

- Only the infrastructure/config layer may read `process.env`.
- API route handlers may read `process.env` for wiring (e.g., Ollama URL).
- Environment variables must be validated at startup (Zod recommended).
- Never hardcode secrets.

---

## 4) Frontend Rules (Next.js + React)

### Rendering model

- Default to Server Components in the App Router.
- Use `"use client"` only when needed (state, effects, DOM measurement, animations, event handlers).
- For heavy/DOM-dependent components, consider `dynamic(..., { ssr: false })` if appropriate.

### Styling and UI

- Tailwind CSS.
- Prefer composable components (small, reusable).
- Accessibility: semantic HTML, labels, aria where needed, keyboard support.
- Responsive-first:
  - Mobile layout must be defined (not an afterthought).
  - The right sidebar day-list must adapt to mobile (e.g., collapsible, drawer, below content).

### Container Queries

- Use `@container` for component-level responsiveness (TaskEditor, cards).
- Container queries respond to the component's width, not the viewport.
- Breakpoint pattern: `@[640px]:flex-row` for stacked → row layouts.
- Add `@container` class to the parent element that defines the query context.

### Animations (Framer Motion)

- Use Framer Motion for complex animations and transitions.
- Patterns:
  - `motion.div` with `initial`, `animate`, `exit` for enter/exit animations.
  - `AnimatePresence` for conditional rendering with exit animations.
  - `Reorder` components for drag-and-drop lists.
- Keep animations subtle and performant (< 300ms for micro-interactions).
- Use `transition={{ duration: 0.2 }}` as a sensible default.
- Avoid animating layout properties that trigger reflows (prefer `transform`, `opacity`).

### State & data

- Keep business rules out of UI components where possible.
- Define shared types for tasks/notes/reminders (and avoid duplicating shapes).
- Avoid prop drilling for large trees; prefer feature-level composition.

### Zustand Store (Global State)

- Global state lives in `src/shared/store/index.ts`.
- Store is persisted via `zustand/middleware/persist`.
- Current state includes:
  - `selectedDate`, `selectedDay` — calendar selection
  - `tasksByDay` — tasks organized by day number (1-31)
  - `notes` — notes organized by ISODate
  - `topicPositions` — UI positions for floating topic bubbles
  - `highlightedTopic` — currently highlighted topic for visual feedback
- Keep actions inside the store (e.g., `addTask`, `removeTask`, `reorderTasks`).
- Use selectors for derived state when possible.

---

## 5) Authentication Rules

### Current state (implemented)

JWT authentication is **fully implemented** with access + refresh tokens in httpOnly cookies.

- **Access token**: Short-lived (default 15 min), HS256 signed with `jose`.
- **Refresh token**: Long-lived (default 30 days), stored hashed (SHA-256) in database.
- **Token rotation**: New refresh token issued on each `/api/auth/refresh`; old token revoked.
- **Reuse detection**: If a revoked token is reused, all user tokens are revoked (session compromise response).
- **Cookie attributes**: `httpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`.
- Backend extracts user ID via `getAuthUserId(request)` which reads the JWT cookie and verifies signature.
- HMAC-signed callbacks (n8n → API) do NOT use JWT; they verify `X-Signature` + `X-Timestamp`.

### Dev fallback

- In non-production environments, an `x-user-id` header is accepted as fallback if no JWT cookie is present.
- Controlled by env `NEXT_PUBLIC_DEV_USER_ID`.

### Password policy

- Minimum 8 characters with uppercase, lowercase, number, and special character.
- Bcrypt with 12 salt rounds.
- Login rate limiting: 5 failed attempts per IP triggers 5-minute lockout.

### Auth endpoints

`/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/recover`, `/api/auth/reset-password`, `/api/auth/change-password`.

If any security tradeoff is unclear, ask before implementing.

---

## 6) Workers & Async Processing (BullMQ + n8n)

### BullMQ Workers

- Three queues: `reminders`, `summaries`, and `transcriptions`, each with a dedicated worker.
- Run workers with: `pnpm worker:reminders` / `pnpm worker:summaries` / `pnpm worker:transcriptions`.
- Workers are built separately via `pnpm build:workers` (tsup).
- Reminder scheduling must be reliable and idempotent.
- Jobs should include a stable identifier to avoid duplicates.
- Failures must be observable (Sentry + structured pino logs).
- Do not block API requests with long-running tasks; enqueue work instead.
- Queue monitoring available via Bull Board: `pnpm monitor:queues`.

### n8n Integration

- n8n orchestrates external async workflows (summaries, transcriptions, reminders).
- Communication: Worker → n8n webhook (HMAC-signed) → n8n processes → callback to API (HMAC-signed).
- Callbacks to the API use HMAC signature verification (SHA-256 + timestamp ±5 min), NOT JWT.
- n8n workflows must be documented (inputs, outputs, callbacks).
- Workflow definitions stored in `n8n/workflows/`.

### AI Features (Ollama)

- **Embeddings**: Ollama (`qwen3-embedding:latest`) generates 768-dim vectors for topics and entries.
- **Auto-topic**: Cosine similarity via pgvector finds the best matching topic.
- **Summaries**: Async flow via BullMQ → n8n → LLM → callback → in-app notification.
- **Transcriptions**: YouTube videos in entries, async via BullMQ → n8n → transcript → callback.
- **OCR**: Extract text from images via Ollama vision model (`glm-ocr:q8_0`), synchronous.
- Embedding operations are synchronous (API waits for Ollama response).
- Summary/transcription generation is asynchronous (202 Accepted, notification on completion).

### AI Guardrails

All AI features are protected by per-user guardrails:

- **Rate limits**: per-minute and per-hour request caps per AI action.
- **Concurrency limits**: max simultaneous requests per user (Redis-backed).
- **Monthly quotas**: tracked in `AiUsageMonthly` / `AiUsageLedger` tables.
- **Input size limits**: max characters per request.
- Usage visible to users at `/api/ai/usage` and in the Settings section.

---

## 7) Testing Policy (TDD-Friendly)

### Test Stack

- **Vitest**: Fast test runner with native TypeScript support
- **Testing Library**: React testing utilities (behavior-focused)
- **jsdom**: Browser environment for component tests
- **Playwright**: E2E tests for critical flows

### Commands

```bash
pnpm test           # Watch mode (interactive development)
pnpm test:run       # Single run (CI/CD)
pnpm test:coverage  # With coverage report
```

### Preferred workflow

- TDD when feasible: red → green → refactor.
- Tests are required for core logic and critical user flows.
- Write tests BEFORE implementing features.

### Testing layers

- **Unit**: domain logic / pure functions / utilities
- **Component**: React components with Testing Library (focus on user behavior)
- **Integration**: use cases + repository adapters (test DB when needed)
- **E2E**: Playwright for critical flows (auth + calendar operations + reminders)

### Test file naming

- Unit/Component tests: `*.test.ts` or `*.test.tsx` (colocated with source)
- Integration tests: `src/__tests__/*.test.ts`
- E2E tests: `e2e/*.spec.ts` (when Playwright is configured)

### Coverage policy (strategic)

- 100% for core business rules and auth/access control paths.
- High coverage for scheduling/reminder logic.
- Lower priority for glue code/wiring.

### Best practices

- Test behavior, not implementation details.
- Use `screen.getByRole`, `getByLabelText` over `getByTestId`.
- Avoid testing internal state; test what the user sees.
- Mock external dependencies (API calls, timers) when needed.

### Avoid

- Overusing snapshots for meaningful UI logic.
- Flaky E2E: use stable selectors and deterministic test data.
- Testing implementation details (internal state, private methods).

### SonarJS no-duplicate-string

- **Do not fix** `sonarjs/no-duplicate-string` in any file (tests or production). Duplicate string literals are accepted as-is; do not extract constants to satisfy this rule.

---

## 8) Performance & UX Rules

- Favor perceived performance:
  - skeleton loading
  - progressive rendering
  - optimistic updates when safe
- Avoid unnecessary re-renders and heavy client bundles.
- Large lists should be handled efficiently (pagination/virtualization if needed).

---

## 9) Observability (Sentry)

- Add Sentry instrumentation where relevant (web/api/worker).
- Capture errors with context, but never include secrets or tokens in logs.
- Monitor job failures in the worker.

---

## 10) Documentation Rules (Docs-as-Code)

- Update docs in the **same PR** when behavior/API changes.
- APIs must be documented with OpenAPI (see section 10b below).
- Architectural decisions must be recorded as ADRs (`docs/adr/`) when they affect future evolution.
- Update AGENTS.md and README.md when introducing new architectural patterns or tools.

### 10b) OpenAPI Specification

The project has a **single-source OpenAPI 3.1 spec** in `openapi/spec.ts`.

**Workflow:**

```bash
pnpm openapi:emit      # spec.ts → openapi/openapi.json
pnpm openapi:types     # openapi.json → src/shared/api/openapi-types.ts (auto-generated)
pnpm openapi:generate  # Both steps combined
```

**Rules:**

- When adding/modifying an API endpoint, update `openapi/spec.ts` in the same PR.
- Never edit `openapi/openapi.json` or `openapi-types.ts` by hand — they are generated.
- The spec is served at runtime via `GET /api/openapi.json` (no auth required).
- Security schemes: `CookieAuth` (JWT httpOnly cookie) + `DevUserIdHeader` (dev fallback).

---

## 11) Git & PR Workflow

- Every change must be submitted via Pull Request.
- Keep PRs small and focused.
- Include:
  - what changed
  - why
  - how to test
  - screenshots/video for UI changes (if possible)
  - security considerations for auth/data features

Commit message guideline:

- `feat: ...`, `fix: ...`, `chore: ...`, `test: ...`, `docs: ...`

---

## 12) Definition of Done (per feature)

A feature is done when:

- It matches requirements and is responsive.
- Security and access control are enforced server-side.
- Lint + typecheck pass.
- Tests are added/updated (unit/integration and/or E2E as applicable).
- Docs are updated if needed.
- No secrets are introduced.
- PR is ready to review.

---

## 13) If You Need Clarification

Ask concise questions about:

- Data model (entry fields, topic linking, reminder rules)
- Mobile behavior of calendar/day sidebar
- Token storage strategy (cookies vs alternatives)
- API shape and naming conventions
- Embedding model/dimension changes
- n8n workflow design (webhooks, callbacks, HMAC)
- OpenAPI spec coverage when adding new endpoints
- Whether a feature is MVP vs post-MVP
