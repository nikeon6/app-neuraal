# TFM — Calendar Tasks & Notes (Next.js)

A web application where authenticated users can manage **tasks** and **notes** through a **calendar-driven dashboard**, including **reminders** processed asynchronously.

> Key requirement: **responsive UI** (desktop and mobile) from day one.

---

## Product Overview

Users can:
- Sign up / log in securely.
- Access a dashboard with a summary view.
- Create, edit, and manage tasks and notes.
- Browse tasks by day using a **right-side day list** (expandable per day).
- Schedule reminders for tasks (processed by a worker).

---

## Tech Stack

- **Frontend**: React 19 + Next.js 16 + TypeScript (App Router)
- **Styling**: Tailwind CSS
- **Backend**: Postgres + pgvector + S3-compatible storage
- **Async jobs**: BullMQ + Redis + Worker
- **Testing**: Vitest + Testing Library + Playwright
- **Quality**: ESLint + SonarJS + jsx-a11y + Prettier
- **Observability**: Sentry
- **Package manager**: **pnpm only**

---

## Recommended Repository Structure

Monorepo with pnpm workspaces:

```
/apps
  /web        # Next.js UI
  /api        # Backend (REST + OpenAPI)
  /worker     # BullMQ workers
/packages
  /shared     # Shared types & pure utilities (no Next/Node runtime code)
  /eslint-config
  /tsconfig
/docs
  /adr        # Architecture Decision Records
  /api        # OpenAPI specs and API docs
  /guides     # Guides (auth, deploy, testing, etc.)
```

> If you start with UI only, keep `apps/web` and add `apps/api` + `apps/worker` later without changing the overall structure.

---

## Current Source Structure (Feature-Based)

The codebase follows a **feature-based architecture** with clear separation between shared (global) and feature-specific (local) code:

```
src/
  app/                    # Next.js App Router pages
    page.tsx              # Home page
    login/page.tsx        # Login page
    layout.tsx            # Root layout
    globals.css           # Global styles
  
  shared/                 # Global Scope - available across the entire app
    types/                # Domain types (Task, Note, Topic, etc.)
    lib/                  # Shared utilities (cn, uid, clamp, etc.)
    constants/            # Business rules and constants (TOPICS, DAYS)
    store/                # Global Zustand store
    hooks/                # Reusable custom hooks
    ui/                   # Reusable UI components (Button, Modal, etc.)
  
  features/               # Local Scope - feature-specific code
    dashboard/            # Main dashboard feature
      components/
    calendar/             # Calendar feature
      components/
    tasks/                # Task management feature
      components/
    topics/               # Floating topics/bubbles feature
      components/
    layout/               # App layout with auth protection
      components/
  
  infrastructure/         # External services (Sentry, API clients)
  
  test/                   # Test configuration
    setup.ts              # Vitest setup file
```

### The Scope Rule

| Type | Location | Visibility | Examples |
|------|----------|------------|----------|
| Global Scope | `src/shared/` | Entire app | Types, utils, constants, store, hooks, UI |
| Local Scope | `src/features/X/` | Only feature X | Dashboard, Calendar, TaskForm |
| Infrastructure | `src/infrastructure/` | Services layer | Sentry, API clients |

### Benefits

- **Modularity**: Each feature is independent and self-contained
- **Efficient reuse**: Shared components without redundancy
- **Lazy loading**: Features can be loaded on demand
- **Clarity**: Easy to find and understand code location
- **Scalability**: New features don't affect existing ones

---

## Prerequisites

- Node.js (LTS recommended)
- pnpm
- Docker (recommended for Postgres/Redis)

---

## Install

```bash
pnpm install
```

---

## Development

```bash
pnpm run dev
```

---

## Testing

This project uses **Vitest** + **Testing Library** for testing, following a **TDD approach**.

### Test Commands

```bash
# Run tests in watch mode (interactive development)
pnpm test

# Run tests once (CI/CD mode)
pnpm test:run

# Run tests with coverage report
pnpm test:coverage
```

### Test Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Fast test runner with native TypeScript support |
| **Testing Library** | Testing utilities focused on user behavior |
| **jsdom** | DOM environment for testing React components |
| **@testing-library/jest-dom** | Custom matchers for DOM assertions |
| **@testing-library/user-event** | Simulates user interactions |

### Test Structure

```
src/
  __tests__/              # Integration tests
  components/
    ComponentName/
      ComponentName.tsx
      ComponentName.test.tsx   # Component tests
  domain/
    types.ts
    types.test.ts              # Domain logic tests
  lib/
    store.ts
    store.test.ts              # Store tests
    utils.ts
    utils.test.ts              # Utility tests
```

### TDD Workflow

1. **Red**: Write a failing test
2. **Green**: Write the minimum code to pass
3. **Refactor**: Improve the code while keeping tests green

### Coverage Targets

- **Domain logic**: 100%
- **Auth/access control**: 100%
- **Core utilities**: High coverage
- **UI components**: Focus on behavior, not implementation

---

## Environment Variables

All secrets must come from environment variables and must be **validated at startup** (Zod validation recommended).

Example (high-level; actual variables may evolve):

### Web (`apps/web/.env.local`)
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `SENTRY_DSN` (optional)

### API (`apps/api/.env`)
- `DATABASE_URL`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `SENTRY_DSN` (optional)

### Worker (`apps/worker/.env`)
- `REDIS_URL`
- `DATABASE_URL` (if applicable)
- `S3_*` (if applicable)
- `SENTRY_DSN` (optional)

**Never commit `.env*` files** with real secrets.

---

## Core Functional Requirements (MVP)

### Authentication
- Sign up / log in / log out.
- JWT-based auth using **two tokens**:
  - Short-lived **access token**
  - Long-lived **refresh token** (rotation recommended)
- Strong password policy.

### Dashboard
- Summary view (today / upcoming tasks / recent notes / upcoming reminders).
- Quick actions: create task / create note.

### Calendar + Right Sidebar Days
- Calendar view with:
  - Right-side list of days
  - Expandable day panels showing tasks for that day

### Tasks
- CRUD tasks, mark as done, reschedule.
- Every resource belongs to a user (strict server-side access control).

### Notes
- CRUD notes.
- Decision via ADR: link notes to a day and/or to a task depending on final UX.

### Reminders
- Users can schedule reminders for tasks.
- Asynchronous processing via BullMQ/Redis in `apps/worker`.

---

## Non-Functional Requirements

### Security by Design
- Apply OWASP Top 10 principles.
- Access control must be enforced **server-side**, never only in the UI.
- Validate inputs at every boundary.
- Secure cookie settings for auth tokens: `HttpOnly`, `Secure` (prod), appropriate `SameSite`.
- Brute-force protections for login: rate limiting + temporary lock/backoff.

### Architecture & Maintainability
- Clean Architecture (light) with strict boundary discipline.
- Avoid antipatterns and unnecessary coupling.
- **All code and code comments must be in English** (docs can be EN/ES).

### Performance (Real + Perceived)
- Skeleton/loading states.
- Avoid heavy client bundles (Server Components by default).
- For large lists: pagination/virtualization if needed.

### Accessibility
- Follow `jsx-a11y` rules and good a11y practices:
  - labels
  - correct roles
  - visible focus
  - keyboard support

---

## Testing Strategy

- Unit: domain logic / pure utilities.
- Integration: use cases + adapters (use test DB when needed).
- E2E (Playwright) for critical flows:
  - login → create task → see it in day panel → schedule reminder

Use **strategic coverage**: prioritize auth, permissions, scheduling, and critical business rules.

---

## Observability (Sentry)

- Enable Sentry in web/api/worker where applicable.
- Capture failures with context (never log secrets/tokens).
- Monitor latency and job failures.

---

## API Documentation

- OpenAPI + Swagger for endpoints.
- Docs-as-Code: update docs in the same PR as the API changes.

---

## Git Workflow (Pull Requests)

- Changes must go through Pull Requests.
- Keep PRs small and reviewable.
- Include: what changed, why, how to test, and security notes where relevant.

Suggested convention:
- `feat/<scope>-<short>`
- `fix/<scope>-<short>`
- `chore/<scope>-<short>`

---

## Deployment (Production)

- Docker + `docker-compose` on a VPS.
- Typical services:
  - web, api, worker, postgres (volume), redis
- Secrets via environment variables on the VPS.
- Automated migrations during deployment (defined in the deployment guide).

---

## License

TBD
