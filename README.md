# TFM — Calendar Tasks & Notes (Next.js)

Web application for authenticated users to manage **tasks** and **notes** through a **calendar-driven dashboard**, including **reminders** processed asynchronously.

## Product Overview

Users can:
- Sign up / log in securely.
- Access a dashboard with a summary of their activity.
- Create, edit, and manage tasks and notes.
- Browse tasks by day using a **right-side day list** (expandable per day).
- Schedule reminders for tasks (processed by a worker).

**Responsive-first UI**: the app must work smoothly on desktop and mobile.

---

## Tech Stack

- **Frontend**: React 19 + Next.js 16 + TypeScript (App Router)
- **Styling**: Tailwind CSS
- **Backend**: Postgres + pgvector, S3-compatible storage
- **Async jobs**: BullMQ + Redis + Worker
- **Testing**: Vitest + Testing Library + Playwright
- **Quality**: ESLint + SonarJS + jsx-a11y + Prettier
- **Observability**: Sentry
- **Package manager**: **pnpm only**

---

## Repository Layout (recommended)

Monorepo (pnpm workspaces):

/apps
/web # Next.js UI
/api # Backend (REST + OpenAPI)
/worker # BullMQ workers
/packages
/shared # Shared types & pure utils (no Next/Node runtime code)
/eslint-config
/tsconfig
/docs
/adr # Architecture Decision Records
/api # OpenAPI specs and API docs
/guides # How-to guides (auth, deploy, testing, etc.)

yaml
Copiar código

If the project starts only with UI, we still keep the structure future-proof (add `apps/api` and `apps/worker` when needed).

---

## Getting Started

### Prerequisites
- Node.js (LTS recommended)
- pnpm
- Docker (recommended for Postgres/Redis)

### Install
```bash
pnpm install
Run (dev)
bash
Copiar código
pnpm run dev
Project standard: use pnpm exclusively (pnpm install, pnpm run dev, pnpm test).

Environment Variables
All secrets must come from environment variables and must be validated at startup (Zod validation recommended).

Example (high-level; actual variables may evolve):

Web (apps/web/.env.local)
NEXT_PUBLIC_APP_URL

NEXT_PUBLIC_API_URL

SENTRY_DSN (optional)

API (apps/api/.env)
DATABASE_URL

REDIS_URL

S3_ENDPOINT

S3_ACCESS_KEY

S3_SECRET_KEY

S3_BUCKET

JWT_ACCESS_SECRET

JWT_REFRESH_SECRET

JWT_ACCESS_TTL

JWT_REFRESH_TTL

SENTRY_DSN (optional)

Worker (apps/worker/.env)
REDIS_URL

DATABASE_URL (if needed)

S3_* (if needed)

SENTRY_DSN (optional)

Never commit .env* files with real secrets.

Core Functional Requirements (MVP)
Authentication
Sign up / log in / log out.

JWT-based auth using two tokens:

Short-lived access token

Long-lived refresh token (rotation recommended)

Strong password policy.

Dashboard
Summary view (today / upcoming tasks / recent notes / reminders).

Quick actions to create task/note.

Calendar + Right Sidebar Days
Calendar view with:

Right-side list of days

Expandable days showing tasks

Tasks
CRUD tasks, mark as done, reschedule.

Task belongs to a user (strict access control).

Notes
CRUD notes.

Optionally link notes to a day or a task (final decision via ADR).

Reminders
Users can schedule reminders for tasks.

A worker processes reminder jobs (BullMQ/Redis).

Non-Functional Requirements
Security by Design
Follow OWASP Top 10 principles across the app.

No direct access control in UI only (must be enforced server-side).

Input validation on every boundary.

Proper cookie settings for auth tokens (httpOnly/secure/sameSite).

Rate limiting and brute-force protections for auth endpoints.

Quality & Maintainability
Clean Architecture (light but enforce boundaries).

Avoid antipatterns; prefer modern React/Next patterns.

Code and code comments must be in English.

Performance (Perceived + Real)
Responsive, fast interactions.

Loading states/skeletons, optimistic UI where appropriate.

Avoid heavy client-side rendering when server rendering fits.

Accessibility
Use jsx-a11y rules.

Keyboard navigation, focus states, semantic HTML.

Testing Strategy
Unit tests (domain logic / pure functions)

Integration tests (use cases + repositories with test DB if needed)

E2E tests (Playwright) for critical flows:

login → create task → see it in day panel → schedule reminder

Coverage should be strategic, focusing on core logic and critical flows first.

Observability (Sentry)
Error tracking enabled in web/api/worker (as applicable).

Capture key failures (auth errors, job failures, DB errors).

Monitor performance (API latency, slow pages).

API Documentation
Use OpenAPI + Swagger for HTTP APIs.

Keep docs updated as code changes (Docs-as-Code approach).

Git Workflow
Use feature branches and Pull Requests for every change.

Keep PRs small and reviewable.

Update docs/tests along with features.

Branch naming suggestion:

feat/<scope>-<short>

fix/<scope>-<short>

chore/<scope>-<short>

Deployment (Production)
Docker-based deployment with docker-compose on a VPS.

Services typically include:

web

api

worker

postgres (with volume)

redis

Secrets via environment variables on the VPS.

Automated migrations during deployment (defined in deploy steps).

License
TBD