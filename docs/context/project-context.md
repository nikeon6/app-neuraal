# Neuraal — Complete Project Context

> This document provides full context for AI assistants to understand and work on the Neuraal project.
> For backend architecture and design decisions, see `docs/context/backend-plan.md`.
> For non-negotiable rules and conventions, see `AGENTS.md`.

---

## 1. Project Overview

**Neuraal** is a responsive task/notes management web app with:

- Calendar-driven dashboard with multiple sections (daily log, weekly recap, stickies, topics, settings)
- Interactive floating topic bubbles with SVG wire connections
- Rich text editor (TipTap) for entries (tasks + notes)
- Drag-and-drop task and sticky note reordering
- Topic-based entry categorization (user-defined, color-coded, with AI auto-classification)
- File attachments with S3 presigned URL flow and per-user/per-entry quotas
- Sticky notes (kanban-style, two-column layout)
- Weekly recap analytics (completion chart, daily bar chart, topic bubble chart)
- Scheduled reminders (BullMQ/Redis + n8n)
- AI features: summaries, auto-topic classification, OCR, YouTube transcription
- In-app notifications for async operations
- Full JWT authentication (access + refresh tokens in httpOnly cookies)

**Status:** Backend fully implemented. Frontend feature-complete for MVP.

---

## 2. Tech Stack

| Category         | Technology                  | Version   |
| ---------------- | --------------------------- | --------- |
| Framework        | Next.js (App Router)        | 16.1.6    |
| React            | React                       | 19.2.0    |
| Language         | TypeScript                  | ^5        |
| Styling          | Tailwind CSS                | ^4        |
| State Management | Zustand (with persist)      | ^5.0.8    |
| Server State     | TanStack Query              | ^5.90.20  |
| Rich Text Editor | TipTap 3 (ProseMirror)      | ^3.19.0   |
| Animations       | Framer Motion               | ^12.23.24 |
| Charts           | Recharts                    | ^3.7.0    |
| Date Handling    | date-fns                    | ^4.1.0    |
| Icons            | Lucide React                | ^0.554.0  |
| ORM              | Prisma                      | 7.3.0     |
| Database         | PostgreSQL + pgvector       | —         |
| Object Storage   | S3-compatible (MinIO dev)   | —         |
| Queue            | BullMQ + Redis              | ^5.67.2   |
| Auth             | jose (JWT) + bcryptjs       | —         |
| Logging          | pino + pino-pretty          | ^10.3.1   |
| Metrics          | prom-client (Prometheus)    | ^15.1.3   |
| AI/Embeddings    | Ollama (local)              | —         |
| Automation       | n8n (webhook orchestration) | —         |
| Observability    | Sentry                      | ^10.39.0  |
| Testing          | Vitest + Testing Library    | ^4.0.18   |
| E2E Testing      | Playwright                  | ^1.58.2   |
| Package Manager  | **pnpm only**               | 10.30.0   |

---

## 3. Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home → MainLayout + Dashboard
│   ├── login/page.tsx            # Login page
│   ├── register/page.tsx         # Registration page
│   ├── recover/page.tsx          # Password recovery
│   ├── reset-password/page.tsx   # Password reset
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   └── api/                      # API route handlers (thin wiring layer)
│       ├── auth/                 # register, login, refresh, logout, me, recover, reset, change-password
│       ├── entries/              # CRUD + reorder, summarize, classify-topic, transcribe
│       ├── topics/               # CRUD + embed
│       ├── reminders/            # CRUD + pending
│       ├── notifications/        # list + mark-read
│       ├── stickies/             # CRUD + reorder
│       ├── attachments/          # init, complete, delete, download
│       ├── ai/                   # usage, ocr
│       ├── automations/          # callbacks (summary, transcription, reminder)
│       ├── storage/              # usage
│       ├── metrics/              # Prometheus endpoint
│       └── health/               # Health check
│
├── domain/                       # Clean Architecture: Domain layer
│   ├── core/                     # Result type
│   ├── entities/                 # Entry, Topic, User, Reminder, Notification, Sticky,
│   │                             # Attachment, EntrySummaryRequest, TranscriptionRequest
│   └── value-objects/            # Email, Password, HexColor, ISODate, EmbeddingVector,
│                                 # SimilarityScore, MimeType, StorageKey, Channel, etc.
│
├── application/                  # Clean Architecture: Application layer
│   ├── core/                     # UseCaseError
│   ├── dto/                      # AuthDTO, EntryDTO, TopicDTO, ReminderDTO, etc.
│   ├── ports/                    # Repository interfaces, service ports
│   ├── use-cases/                # All business logic (auth, entries, topics, AI, etc.)
│   └── test/                     # InMemory repos, Fake ports (test doubles)
│
├── infrastructure/               # Clean Architecture: Infrastructure layer
│   ├── auth/                     # JoseJwtService, BcryptPasswordHasher, AuthCookies
│   ├── automation/               # N8NClient (HMAC-signed webhooks)
│   ├── config/                   # AiGuardrailsConfig, AttachmentConfig
│   ├── embedding/                # OllamaEmbeddingProvider
│   ├── http/                     # withApiContext, requestContext
│   ├── logging/                  # pino structured logger (JSON, auto-redaction)
│   ├── metrics/                  # Prometheus counters and histograms
│   ├── ocr/                      # OllamaVisionProvider
│   ├── persistence/              # Prisma client, 13 PrismaXxxRepository implementations
│   ├── queue/                    # BullMQAdapter, workers (reminder, summary, transcription)
│   ├── redis/                    # RedisClient, RedisRateLimiter, RedisConcurrencyLimiter
│   └── storage/                  # S3ObjectStorage (presigned URLs)
│
├── features/                     # Frontend: Feature-based modules (LOCAL scope)
│   ├── dashboard/                # Main dashboard layout + header
│   ├── calendar/                 # VerticalCalendar (desktop vertical / mobile horizontal)
│   ├── tasks-container/          # Drag-and-drop task list (Framer Motion Reorder)
│   ├── task-editor/              # Rich task/note editor (TipTap) with container queries
│   ├── topics/                   # Floating topic bubbles + SVG wires + TopicsSection
│   ├── stickies/                 # Kanban-style sticky notes (two-column)
│   ├── weekly-recap/             # Weekly analytics (charts, completion, topic bubbles)
│   ├── notifications/            # In-app notification center
│   ├── attachments/              # File attachment UI components
│   ├── settings/                 # User settings (AI usage, storage, change password)
│   └── layout/                   # MainLayout (auth protection, ambient background)
│
├── shared/                       # Frontend: GLOBAL scope (available everywhere)
│   ├── api/                      # Centralized API client (apiFetch), OpenAPI types, query hooks
│   │   ├── sdk.ts                # Type-safe API SDK
│   │   ├── openapi-types.ts      # Auto-generated from openapi/spec.ts
│   │   └── queries/              # TanStack Query hooks (entries, topics, reminders, etc.)
│   ├── types/                    # Shared frontend types
│   ├── lib/                      # Utilities (cn, uid, clamp, extractPlainText...)
│   ├── constants/                # Business rules (embedding config, days...)
│   ├── store/                    # Zustand global store (UI state only)
│   ├── hooks/                    # Reusable custom hooks
│   └── ui/                       # Reusable UI components (MinimalTiptapEditor, etc.)
│
├── generated/                    # Prisma generated client
└── test/
    └── setup.ts                  # Vitest setup
```

---

## 4. Import Rules (CRITICAL)

**Frontend:**

```
shared/         → can import from shared/ only
features/X/     → can import from shared/ AND features/X/ only

❌ NEVER import across features (features/A/ → features/B/)
```

**Backend:**

```
domain/         → imports from domain/ only (zero external deps)
application/    → imports from domain/ and application/ only
infrastructure/ → imports from application/ + domain/
app/api/        → imports from infrastructure/ + application/ (wiring)
```

---

## 5. Zustand Store (`src/shared/store/index.ts`)

The store holds **UI-only state**. All server data (entries, topics, reminders, notifications) comes from **TanStack Query**.

### State Shape

```typescript
interface AppState {
  // User (from auth)
  user: { id: string; email: string } | null;
  login: (user: { id: string; email: string }) => void;
  logout: () => void;

  // Calendar/Date selection
  selectedDate: Date;
  selectedDay: number; // 1-31
  setSelectedDate: (date: Date) => void;
  setSelectedDay: (day: number) => void;

  // Topic UI state (positions stored per-user in localStorage)
  topicPositions: TopicPositions; // Record<string, {x, y}>
  setTopicPosition: (topicId: string, position: TopicPosition) => void;

  highlightedTopic: string | null;
  setHighlightedTopic: (topicId: string | null) => void;

  // Topic selection + day expansion (wire connections)
  selectedTopicIds: string[];
  selectedTopicIdsManual: string[];
  expandedDayKeys: ISODate[];
  pinnedDayKeys: ISODate[];
  toggleTopicSelection: (topicId: string) => void;
  setSelectedTopics: (topicIds: string[]) => void;
  expandDay: (
    dateKey: ISODate,
    entriesByDate: Record<string, ApiEntry[]>,
  ) => void;
  collapseDay: (
    dateKey: ISODate,
    entriesByDate: Record<string, ApiEntry[]>,
  ) => void;
  pinDay: (dateKey: ISODate) => void;
  unpinDay: (
    dateKey: ISODate,
    entriesByDate: Record<string, ApiEntry[]>,
  ) => void;
  clearExpandedDays: () => void;
  clearSelection: () => void;

  // Dashboard navigation
  dashboardSection: DashboardSection; // "daily" | "weeklyRecap" | "stickies" | "topics" | "settings"
  setDashboardSection: (section: DashboardSection) => void;

  // Navigation aid
  scrollToEntryId: string | null;
  setScrollToEntryId: (entryId: string | null) => void;
}
```

### Persistence

- Key: `neuraal-storage`
- Persisted: `user`, `dashboardSection`
- Topic positions persisted separately in localStorage per user (`neuraal-positions-{userId}`)

---

## 6. Data Fetching (TanStack Query)

All server data is fetched and cached via TanStack Query hooks in `src/shared/api/queries/`:

| Hook                               | Purpose                       |
| ---------------------------------- | ----------------------------- |
| `useEntriesByDateQuery(dateKey)`   | Entries for a specific date   |
| `useTopicsQuery()`                 | All user topics               |
| `useNotificationsQuery()`          | Unread notifications          |
| `usePendingReminderQuery(entryId)` | Pending reminder for an entry |
| `useStickiesQuery()`               | All user stickies             |
| `useAiUsageQuery()`                | AI usage/quotas               |
| `useStorageUsageQuery()`           | Storage usage                 |
| `useWeeklyRecapQuery(startDate)`   | Weekly analytics data         |

**Watchers** (auto-refresh on notification arrival):

- `useSummaryDoneWatcher(dateKey)` — refreshes entries when summary completes
- `useTranscriptionDoneWatcher(dateKey)` — refreshes entries when transcription completes
- `useReminderDoneWatcher()` — refreshes pending reminder status

---

## 7. Responsive Layout System

### Dashboard Grid (3-column)

```
┌─────────────────────────────────────────────────────────────┐
│  DESKTOP (≥1024px)                                          │
├──────────────────┬────────────────────┬────────────────────┤
│   Tasks Area     │   Bubbles Lane     │   Calendar         │
│   minmax(280px,  │   clamp(260px,     │   180px fixed      │
│   1fr)           │   22vw, 400px)     │   (200px on xl)    │
└──────────────────┴────────────────────┴────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MOBILE (<1024px) - Vertical stack                          │
├─────────────────────────────────────────────────────────────┤
│   Tasks Area (flex-1)                                       │
├─────────────────────────────────────────────────────────────┤
│   Calendar (h-20, horizontal scroll with month buttons)     │
│   [◄Jan][1][2][3●][4][5●][6]...[Jan►]                     │
└─────────────────────────────────────────────────────────────┘
```

### Container Queries (TaskEditor)

TaskEditor uses `@container` for component-level responsiveness:

```tsx
// Parent has @container class
className = "task-editor glass-panel rounded-2xl p-5 w-full @container";

// Children use @[640px] breakpoint
className = "flex flex-col gap-3 mb-2 @[640px]:flex-row @[640px]:items-center";
```

---

## 8. Key Components

### FloatingTopics (`src/features/topics/components/FloatingTopics.tsx`)

Visualization of topics as draggable bubbles with SVG wire connections.

- Draggable bubbles using pointer events (no library)
- SVG wires connect bubbles to calendar days/tasks
- Junction points (neuron dots) at wire split points
- RAF-based animation for smooth junction following (60fps)
- Desktop: vertical layout, Mobile: horizontal strip
- Multi-selection and day expansion for wire connections

### TasksContainer (`src/features/tasks-container/components/TasksContainer.tsx`)

High-performance drag-and-drop task list using Framer Motion `Reorder.Group`/`Reorder.Item` with handle-only dragging and RAF-based auto-scroll.

### VerticalCalendar (`src/features/calendar/components/VerticalCalendar.tsx`)

- **Desktop (lg+):** Vertical scrollable list with task pills per day and expandable day details
- **Mobile (<lg):** Horizontal scrollable row with day buttons, dot indicators, and month navigation buttons on both ends

### TaskEditor (`src/features/task-editor/components/TaskEditor.tsx`)

Rich editor for tasks/notes with TipTap, featuring: entry type toggle, topic selector, auto-save with debounce (1200ms), reminder scheduling, AI actions (summarize, transcribe, OCR), file attachments, and container queries for responsive layout.

### Dashboard (`src/features/dashboard/components/Dashboard.tsx`)

Main layout orchestrating sections (daily log, weekly recap, stickies, topics, settings) with tab navigation and notification watchers.

---

## 9. Scripts

```bash
# Development
pnpm dev                  # Start dev server
pnpm build                # Production build
pnpm lint                 # ESLint
pnpm type-check           # TypeScript check

# Testing
pnpm test                 # Watch mode
pnpm test:run             # Single run (CI/CD)
pnpm test:coverage        # With coverage
pnpm test:e2e             # Playwright E2E

# Workers
pnpm build:workers        # Build workers with tsup
pnpm worker:reminders     # Run reminder worker
pnpm worker:summaries     # Run summary worker
pnpm worker:transcriptions # Run transcription worker
pnpm monitor:queues       # Bull Board queue monitoring

# OpenAPI
pnpm openapi:emit         # spec.ts → openapi.json
pnpm openapi:types        # openapi.json → openapi-types.ts
pnpm openapi:generate     # Both steps combined

# Quality
pnpm quality              # lint + typecheck + test
pnpm verify               # quality + e2e + build
```

---

## 10. Key Patterns

### 1. Clean Architecture (Backend)

Strict layer separation: Domain (entities, value objects) → Application (use cases, ports) → Infrastructure (adapters) → API (thin wiring).

### 2. Feature-scoped modules (Frontend)

Each feature is self-contained with its own components, hooks, and types. No cross-feature imports.

### 3. TanStack Query for server state

All API data flows through query hooks with automatic caching, invalidation, and notification-driven watchers.

### 4. Imperative DOM updates for performance

FloatingTopics uses refs + RAF for 60fps animations without React re-renders.

### 5. Container queries over media queries

TaskEditor responds to its own width, not viewport.

### 6. Framer Motion Reorder for drag-and-drop

Uses motion values for smooth 60fps dragging (no HTML5 drag API).

### 7. Optimistic concurrency control

Entries use a `version` field; 409 Conflict on stale updates triggers refetch.

### 8. HMAC-signed webhooks

All n8n ↔ API communication uses HMAC SHA-256 signatures with timestamp validation.

---

## 11. Component Hierarchy

```
Home
└── MainLayout (auth check, ambient BG, logout)
    └── Dashboard (section tabs + content)
        ├── DashboardHeader (section navigation + date display)
        ├── [daily] TasksContainer → ReorderableTaskItem[] → TaskEditorWrapper → TaskEditor
        ├── [weeklyRecap] WeeklyRecap (charts + analytics)
        ├── [stickies] StickiesContainer (kanban grid)
        ├── [topics] TopicsSection (topic pills + management)
        ├── [settings] Settings (AI usage, storage, password)
        ├── FloatingTopics (absolute overlay, z-15, SVG wires)
        └── VerticalCalendar (right sidebar / bottom mobile)
```

---

## 12. Architecture Decisions (ADRs)

| ADR | Status     | Decision                                          |
| --- | ---------- | ------------------------------------------------- |
| 001 | Accepted   | Next.js App Router + feature-first structure      |
| 002 | Accepted   | Feature-scoped state first, Zustand for global    |
| 003 | Accepted   | Vitest + Testing Library + Playwright             |
| 004 | Accepted   | JWT access/refresh tokens + httpOnly cookies      |
| 005 | Accepted   | Sentry for observability                          |
| 006 | Superseded | OAuth + Auth.js (superseded by ADR-004)           |
| 007 | Accepted   | Hybrid persistence (Postgres + S3)                |
| 008 | Accepted   | n8n + BullMQ for async job orchestration          |
| 009 | Accepted   | pgvector embeddings for auto-topic classification |
| 010 | Accepted   | OpenAPI spec as source of truth + generated types |
| 011 | Accepted   | AI guardrails and usage tracking                  |
| 012 | Accepted   | TipTap 3 as rich text editor                      |
| 013 | Deprecated | WhatsApp via Evolution API (banned by Meta)       |
| 014 | Accepted   | Docker multi-stage build + CI/CD pipeline         |
| 015 | Accepted   | Structured logging (pino) + Prometheus metrics    |
| 016 | Accepted   | TanStack Query for server state management        |

---

## 13. Environment

- Windows 11
- Node.js 20 LTS
- pnpm 10.30.0
- Docker Compose for services (Postgres, Redis, MinIO, n8n, Ollama)

---

## 14. Style Guidelines

- **English:** All code, comments, and commit messages
- **Spanish:** UI text/labels (user-facing)
- **Responsive-first:** Mobile layout defined first
- **Accessibility:** Labels, ARIA, keyboard support
- **No overengineering:** Minimal changes for requirements

---

_Last updated: 2026-02-21_
