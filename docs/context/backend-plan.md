# Neuraal — Backend/API + AI + Automations (Clean Architecture)

**Date:** 2026-02-03
**Goal:** Reference document for building the API and backend layer following Clean Architecture and TDD, integrating **Postgres + S3 + Redis/BullMQ + n8n**, and supporting: JWT login (access/refresh), calendar dashboard, tasks/notes with a rich text editor, attachments with quotas, per-user embeddings, and async workflows (summaries, reminders, auto-classification).

> **Status (Feb 2026):** The backend described in this plan is **fully implemented**. The source of truth for rules, layers, folder structure, and current endpoints is:
>
> - `AGENTS.md` — project rules, architecture, layers, folder structure, auth, workers, AI.
> - `openapi/spec.ts` → `openapi/openapi.json` — API contracts (generated with `pnpm openapi:generate`).
> - `prisma/schema.prisma` — data model.
>
> This document is maintained as **design decision context and original plan reference**.

> Existing UI context (Next.js App Router, Zustand, feature-first structure, import rules) in `docs/context/project-context.md`.
> Architecture foundation (Clean Architecture-inspired, security, testing) in `docs/design.md`.

---

## 0) Confirmed Decisions (Executive Summary)

### Stack and Key Components

- **Frontend/Web:** Next.js (App Router) + React + TypeScript + Tailwind; UI already well advanced.
- **Primary Persistence:** **PostgreSQL** self-hosted on VPS.
- **Vectors:** **pgvector** in the same Postgres instance (phase 1).
- **Files/Attachments:** **S3** (or S3-compatible) for objects; metadata and quotas in Postgres.
- **Queues and Workers:** **Redis + BullMQ** for deferred and async jobs (reminders, n8n calls, etc.).
- **Automation/AI and Integrations:** **n8n** confirmed to orchestrate workflows (AI summaries, message delivery, etc.). (ADR-008 in design docs)
- **Architecture:** Clean Architecture-inspired with Domain / Application / Infrastructure / UI layers.
- **Testing:** TDD starting with Domain/Application using Vitest (already in project).

### Auth

- **JWT** with **short-lived Access Token** + **long-lived Refresh Token**, with rotation.
- **Strong recommendation:** **httpOnly cookies** (not localStorage) to prevent XSS token theft.
  > Note: cookies are **not** inherently "insecure"; what's insecure is misusing them (e.g., without `httpOnly`, without `SameSite`, without `secure`, etc.). The design document already points to this pattern.

---

## 1) Architecture Rules and Dependencies

### Layers (Clean Architecture)

- **Domain:** entities, value objects, invariants, pure rules (no Next/Prisma/Redis/n8n).
- **Application:** use cases, DTOs, ports (interfaces) to persistence and external services.
- **Infrastructure:** adapters (Postgres/Prisma, Redis/BullMQ, S3, n8n webhooks, AI if applicable), configuration, logging/monitoring.
- **UI/Presentation:** features/ (components), UI state, view-models; calls Application (not Infrastructure directly).

### Import Rules (preserve existing conventions)

- No cross-module imports between `features/*` (feature A does not import feature B).
- `shared/` remains "global" without UI state (ideally domain-centric).
- Recommended adjustment for backend:
  - `features/*` (UI) can import from `application/` and `domain/`.
  - `infrastructure/*` can import from `application/` and `domain/`.
  - `application/` can import from `domain/`.
  - `domain/` imports from nothing.

---

## 2) Proposed Folder Structure (Compatible With Existing Codebase)

Based on the target structure described in `design.md`.

```
src/
  app/
    api/                       # Route Handlers (HTTP controllers)
      ...
  features/                    # UI feature-first (already exists)
  shared/                      # Shared types and utilities (domain-centric)
  domain/
    entities/
    value-objects/
    services/                  # Pure domain rules (if applicable)
  application/
    use-cases/
    ports/
    dto/
  infrastructure/
    persistence/               # Prisma/Postgres + pgvector
    storage/                   # S3 presigned URLs
    queue/                     # BullMQ + Redis
    automations/               # n8n client + callbacks/webhooks
    auth/                      # JWT, hashing, refresh rotation
    config/                    # env parsing
    monitoring/                # Sentry, logs
docs/
  design.md
  adr/
```

> In practice, `src/app/api/*` acts as a "controller adapter" (Infrastructure) and delegates to Application.

> **As implemented:** The final structure includes additional subdirectories in `infrastructure/`: `automation/`, `embedding/` (Ollama), `ocr/`, `redis/`, `logging/` (pino), `metrics/` (Prometheus), `http/` (request context). `domain/` uses `core/` (Result type) instead of `services/`. `application/` includes `test/` (InMemory repos, fakes). See `AGENTS.md` §3 for the complete structure.

---

## 3) Domain Model (What "Exists" in the Business)

### Key Concepts

- **User**
- **Topic** (per user): name, color, embedding
- **Entry** (unifies Task + Note)
  - `type`: `"task" | "note"`
  - `title`
  - `content` (rich document in JSON)
  - `topicId` (or "AUTO" as UI mode; persisted as final topicId)
  - `completed` (tasks only)
  - `entryDate` (the date it belongs to in the calendar)
- **Attachment** (file associated with an entry, or inline within content)
- **Reminder** (scheduled alert with date/time)
- **Notification** (for dashboard display: "summary ready", "reminder sent", "job failed", etc.)
- **Sticky** (kanban-style sticky note with position and color)

> **As implemented:** Additional entities were added: `EntrySummaryRequest`, `TranscriptionRequest`, and `AiUsageMonthly`/`AiUsageLedger` for AI quota tracking. See `prisma/schema.prisma` for the complete model.

### Domain Rules/Invariants

- A user can only access their own `topics/entries/attachments/reminders/notifications`.
- **Attachment limits:**
  - Max **20 MB** per entry (total sum of its attachments).
  - Max **1 GB** per user (sum of all attachments).
- `completed` only applies if `type == "task"`.
- `Topic.color` must be valid (e.g., `#RRGGBB`).
- `entryDate` always in ISO format (e.g., `YYYY-MM-DD`) to avoid timezone issues.

---

## 4) Persistence: Postgres + pgvector + S3 (Objects)

### Postgres (Minimum Suggested Tables)

> Not the "final model", but sufficient to start with TDD and vertical slices.

- `users`
- `topics`
- `entries`
- `entry_embeddings` _(optional, for caching entry embeddings)_
- `attachments`
- `user_storage_usage` _(or derivable via query + caching)_
- `reminders`
- `notifications`
- `refresh_tokens` _(for stateful rotation in DB; recommended)_

> **As implemented:** The final schema also includes: `stickies`, `entry_summary_requests`, `transcription_requests`, `ai_usage_monthly`, `ai_usage_ledger`. See `prisma/schema.prisma`.

### Key Fields (Concept)

- `topics.embedding` → pgvector vector (per user)
- `entries.content` → `jsonb` (rich document)
- `attachments`:
  - `storage_key` (S3 path)
  - `mime`, `size_bytes`, `sha256`
  - `kind`: `"inline" | "file"`
  - `entry_id`, `user_id`

### S3 (or Compatible)

- Store binaries in S3.
- Store **metadata + ownership + relationships** in Postgres.
- Upload/download from the browser via **presigned URLs** (to avoid proxying binaries through the server).

### Quotas (20MB per entry, 1GB per user)

Recommended pattern:

1. Client requests "initiate upload" → `POST /attachments/init`.
2. API validates:
   - entry total size (current + new) ≤ 20MB
   - user total size ≤ 1GB
3. API returns:
   - `attachmentId`
   - `presignedUrl` (PUT)
   - `storageKey`
4. Client uploads to S3.
5. Client confirms → `POST /attachments/complete` (marks as "ready" and updates counters).

> If confirmation never arrives (browser closed), a cleanup job can review "pending uploads" and reconcile.

---

## 5) Rich Text Editor: How to Store Content (Images, YouTube, Code, Styles)

The requirement ("formatted text + embeds + resizing + snippets") is well served by a **document model** (JSON tree) like ProseMirror/TipTap/Lexical/Slate.

> **As implemented:** **TipTap** (ProseMirror-based) is used. Content is stored as JSON in `entries.content`.

### Recommended Storage

- `entries.content` = **JSON** (jsonb) with:
  - nodes: paragraph, heading, list, code block, YouTube embed, inline image...
  - marks: bold/italic/color, etc.
- Additional fields:
  - `contentVersion` (number) for future schema migrations.
  - `plainText` (optional, derived) for fast search or embeddings.

### Inline Image Relationship

- The "image" node in JSON does **not** store the binary.
- It stores a reference:
  - `attachmentId` or `storageKey`
  - size/align/crop if applicable

### Security

- Sanitize rendering on client/server (especially if accepting HTML).
- Prohibit embedded scripts.

---

## 6) Auto-Save (Automatic Content Saving)

Goal: the editor saves "while writing" without overwhelming the API.

### Proposed Strategy

- UI maintains a local `draft` (Zustand or editor-local state).
- **Debounce** (e.g., 500–1200ms) to batch changes.
- Endpoint `PATCH /entries/:id` with **patches** (EntryPatch) or partial replacement.
- Recommended fields:
  - `updatedAt` + `version` (optimistic concurrency)
- UI:
  - "Saving..." / "Saved" indicator
  - Immediate flush on `blur`, `Cmd+S`, or before changing days.

> **As implemented:** Auto-save with 1200ms debounce, optimistic concurrency via `version` field (409 Conflict on collision), and flush on `blur`/day change. The Zustand store is used for global UI state, but entries are synced with the API via TanStack Query.

---

## 7) AI + n8n: Confirmed Async Workflows

### 7.1 "Summarize" Button (n8n → AI → update entry → notify)

**Goal:** the user clicks "Summarize" and, when finished, the entry is updated and a notification appears in the dashboard.

**Recommended design (robust and "clean"):**

1. UI → `POST /entries/:id/summarize`
2. API (Use Case `RequestEntrySummary`) creates a `notifications` record of type "in-progress" and enqueues job `ENTRY_SUMMARY_REQUESTED`.
3. Worker (BullMQ):
   - Calls n8n (webhook) with `entryId` + `userId` + `callbackUrl` + HMAC signature.
4. n8n:
   - Executes the AI workflow (can use Batch API if desired).
   - When finished, calls the `callbackUrl` (the API) with the summary.
5. API callback:
   - Updates `entries.content` (or adds a "Summary" block)
   - Marks notification as "done"
6. UI:
   - Gets notifications (poll or SSE) and refreshes the entry.

> **As implemented:** Complete flow with BullMQ → n8n (HMAC-signed webhook) → HMAC callback → in-app notification. Notifications are fetched via polling. The frontend uses watchers (`useSummaryDoneWatcher`) to auto-refresh when the notification arrives.

### 7.2 Auto-Classification of Topic ("AUTO" mode)

**Trigger:** when editing is done, if the selector is on "AUTO", classify the entry to the most similar topic.

Two options:

- **Synchronous (simple):** endpoint computes embedding + queries pgvector for the user's topics → returns topicId.
- **Asynchronous (more robust):** enqueues job `ENTRY_CLASSIFY_TOPIC`, notifies on completion.

Recommendation:

- Start **synchronous** if embedding is fast.
- Switch to **asynchronous** if latency is noticeable or you want queues/retries.

> **As implemented:** The **synchronous** approach is used. Embeddings generated with **Ollama** (`qwen3-embedding:latest`, 4096 dimensions). Cosine similarity via pgvector to find the user's most similar topic.

---

## 8) Scheduled Reminders: Redis/BullMQ Worker + n8n (Delivery)

**Goal:** the user schedules a date/time → it must be sent (via the chosen channel) and can leverage n8n.

### Proposed Flow

1. UI → `POST /reminders` (entryId, scheduledAt, channel, payload...)
2. API saves `reminders` in Postgres (source of truth).
3. API enqueues BullMQ job with `delay = scheduledAt - now` (job data: `{ reminderId }`).
4. When the time arrives, Worker:
   - Validates in Postgres that it's still `pending` (avoids duplicates if changed/cancelled)
   - Calls n8n webhook "send-reminder"
   - Marks `sent` / `failed`
   - Creates `notification` in dashboard if applicable.

> **As implemented:** Complete flow. Worker `reminderWorker` consumes the `reminders` queue. The frontend detects `REMINDER_SENT`/`REMINDER_FAILED` via `useReminderDoneWatcher` to automatically update the button state.

> This pattern avoids constant polling and scales by adding more workers.

---

## 9) Dashboard Notifications (for "summary ready", "error", etc.)

### Minimum Model

Table `notifications`:

- `id`, `user_id`
- `type` (SUMMARY_DONE, REMINDER_SENT, JOB_FAILED, ...)
- `title`, `message`, `payload jsonb`
- `status` (unread/read)
- `created_at`

> **As implemented:** Notification types: `REMINDER_SENT`, `REMINDER_FAILED`, `SUMMARY_DONE`, `TRANSCRIPTION_DONE`. Added `SUMMARY_FAILED` and `TRANSCRIPTION_FAILED` for errors.

### Delivery to UI (pick 1 for MVP)

- **Polling**: `GET /notifications?since=...` every 5-15s (easy). ✅ **(implemented)**
- **SSE**: `GET /notifications/stream` (more "pro" with no extra infra).
- WebSocket: more complex (not needed for MVP).

---

## 10) API (Recommended Contracts)

Based on the endpoint skeleton suggested in the design document, extended to the domain.

> **As implemented:** The actual, up-to-date contracts are defined in `openapi/spec.ts` and generated with `pnpm openapi:generate`. Frontend types are auto-generated with `pnpm openapi:types`. The endpoints listed below are the original plan reference; for the current API, consult `openapi/openapi.json`.

### Auth

- `POST /api/auth/register` _(added beyond original plan)_
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `POST /api/auth/recover` _(added)_
- `POST /api/auth/reset-password` _(added)_
- `POST /api/auth/change-password` _(added)_

### Topics

- `GET /api/topics`
- `POST /api/topics`
- `PATCH /api/topics/:id`
- `DELETE /api/topics/:id`
- `POST /api/topics/:id/embed` _(added: generates embedding for a topic)_

### Entries (tasks/notes)

- `GET /api/entries?date=YYYY-MM-DD`
- `POST /api/entries`
- `PATCH /api/entries/:id`
- `DELETE /api/entries/:id`
- `POST /api/entries/:id/summarize`
- `POST /api/entries/:id/classify-topic`
- `POST /api/entries/:id/transcribe` _(added: YouTube transcription)_
- `PATCH /api/entries/reorder` _(added: reorder entries for a day)_

### Attachments

- `POST /api/attachments/init`
- `POST /api/attachments/complete`
- `DELETE /api/attachments/:id`
- `GET /api/attachments/:id/download` _(presigned GET)_

### Reminders

- `POST /api/reminders`
- `GET /api/reminders/pending?entryId=...` _(added)_
- `PATCH /api/reminders/:id` _(reschedule/cancel)_
- `DELETE /api/reminders/:id`

### Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read` _(PATCH instead of POST)_

### Stickies _(added)_

- `GET /api/stickies`
- `POST /api/stickies`
- `PATCH /api/stickies/:id`
- `DELETE /api/stickies/:id`
- `PATCH /api/stickies/reorder`

### AI _(added)_

- `GET /api/ai/usage` _(monthly quotas and usage)_
- `POST /api/ai/ocr` _(text extraction from image via Ollama vision)_

### Storage _(added)_

- `GET /api/storage/usage` _(user's storage usage)_

### Callbacks (n8n → API, HMAC-signed) _(added)_

- `POST /api/callbacks/summary`
- `POST /api/callbacks/transcription`
- `POST /api/callbacks/reminder`

---

## 11) Security (Non-Negotiable Points)

From the design: avoid localStorage/sessionStorage for tokens and prefer httpOnly cookies.

### JWT access/refresh + httpOnly cookies (recommended)

- Cookies:
  - `httpOnly: true`
  - `secure: true` (prod)
  - `sameSite: Lax` (or Strict if no cross-site flows)
- Refresh rotation and DB registration (revoke, detect reuse).
- Short-lived access (e.g., 15 min), long-lived refresh (e.g., 7 days).

> **As implemented:** Access token 15 min (HS256, `jose`), refresh token 30 days (SHA-256 hash in DB). Rotation on every refresh. Reuse detection revokes all user tokens. Login rate limiting: 5 attempts/IP → 5-minute lockout.

### CSRF

- With `SameSite=Lax/Strict` you already reduce risk significantly.
- If you ever need `SameSite=None`, add a CSRF token.

### AuthZ

- Every endpoint validates owner `userId` (401/403).

### n8n Webhooks (very important)

- All webhooks (summary callback, reminder delivery, etc.) must be signed:
  - HMAC (`X-Signature`) with shared secret
  - timestamp + nonce to prevent replay
- Rate limiting on sensitive endpoints (login, webhooks, summarize).

> **As implemented:** HMAC SHA-256 with `X-Signature` + `X-Timestamp` (±5 min window). n8n callbacks do NOT use JWT. Rate limiting on login and AI features (per-minute, per-hour, max concurrency per user, monthly quota).

---

## 12) Workers, BullMQ, and Redis (How They're Used Here)

- **Redis**: fast store where BullMQ keeps queue and job state.
- **BullMQ**: Node library providing queues, delayed jobs, retries, and concurrency.
- **Worker**: separate process that "consumes" jobs and executes actions (call n8n, update Postgres, etc.).

Originally suggested queues:

- `reminders` (delayed)
- `automations` (call n8n)
- `ai` (embeddings/classification)
- `maintenance` (cleanup pending uploads, retries, etc.)

> **As implemented:** The final queues are three: `reminders`, `summaries`, `transcriptions`. Each with its own dedicated worker (`pnpm worker:reminders`, `pnpm worker:summaries`, `pnpm worker:transcriptions`). Workers compiled with tsup (`pnpm build:workers`). Monitoring via Bull Board (`pnpm monitor:queues`). Embeddings run synchronously, not via queue.

---

## 13) Implementation Plan with TDD (Where to Start)

### Principle: Build Vertical Slices

Instead of "building all the architecture at once", you build one complete use case with its test, and repeat.

#### Recommended Order (from simplest to most complex)

1. **Domain**: Minimal Value Objects + Entities (UserId, EntryId, ISODate; Entry, Topic).
2. **Application**: Use cases + ports + tests (mocks/in-memory).
3. **Infrastructure**: Real adapters (Prisma/Postgres, JWT, Redis/BullMQ).
4. **API**: Thin route handlers that only transform HTTP ↔ DTO and call the use case.

### Concrete Slices (Incremental MVP)

1. **Auth (login/refresh/me)** ✅
   - Application tests: validate credentials, issue tokens, refresh rotation.
2. **Topics CRUD** ✅
   - Persist topics per user.
3. **Entries CRUD + autosave** ✅
   - `GET entries by date`, `PATCH entry`.
4. **Attachments (init/complete) + quotas** ✅
   - S3 presigned + counters.
5. **Reminders + delayed worker + n8n webhook** ✅
   - First real end-to-end job.
6. **Summarize (n8n + callback + notification)** ✅
   - Minimal notifications (poll).
7. **Auto topic (embedding + pgvector)** ✅
   - Synchronous with Ollama.

> **Status:** All slices are implemented. Additionally: user registration, password recovery/reset, stickies (kanban), YouTube transcription (async), OCR (sync via Ollama vision), AI guardrails (rate limits, concurrency, monthly quotas), and Prometheus metrics were added.

---

## 14) Open Questions — Resolution

> The original plan questions were all resolved during implementation:

1. **Rich text editor**: Which engine — TipTap/Lexical/Slate or custom?
   → **Resolved:** **TipTap** (ProseMirror) is used. Content stored as JSON in `entries.content`.

2. **Notifications**: Is polling OK for MVP, or SSE from the start?
   → **Resolved:** **Polling** for MVP. SSE remains a future improvement if needed.

3. **Reminder channel**: WhatsApp via n8n (as discussed) — will there also be email/push?
   → **Resolved:** The channel is configurable (`channel` field in reminders). n8n handles delivery. WhatsApp is the primary channel. Email/push not yet implemented.

4. **AI**: Provider and prompt/cost strategy (Batch API, models, limits).
   → **Resolved:** **Ollama** (self-hosted). Embeddings: `qwen3-embedding:latest` (4096 dim). OCR: `glm-ocr:q8_0`. Summaries/transcriptions: LLM via n8n. Guardrails: rate limits + concurrency + monthly quotas per user.

5. **Auth storage**: Final confirmation of "httpOnly cookies" vs alternative.
   → **Resolved:** **httpOnly cookies** confirmed and implemented. Access token (HS256, 15 min) + Refresh token (SHA-256, 30 days, rotation with reuse detection).

---

## 15) Operational Instructions for the AI Building the Project

- Maintain Clean Architecture barriers: Domain and Application without framework dependencies.
- Respect the rule: **no imports between features**; UI calls Application, not Infrastructure directly.
- Do not store tokens in localStorage/sessionStorage.
- Keep `pnpm` as the project's package manager.
- Tests first (TDD) in Domain/Application; integration after.

> **Note:** The complete, up-to-date rules for the AI are in `AGENTS.md` (project root). This document is complementary.

---

**End of document.**
