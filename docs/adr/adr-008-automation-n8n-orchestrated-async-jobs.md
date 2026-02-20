# ADR-008: Automation & Async Workflows: n8n + BullMQ Hybrid

- **Status:** Accepted (updated 2026-01-29)
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — architecture decision

---

## Context

Neuraal requires asynchronous workflows such as:

- Scheduled notifications/messages at a user-defined `sendAt` time.
- Long-running AI tasks (e.g., LLM-generated summaries) where results arrive later.
- Background processing (retries, callbacks, status updates).

The project runs in Docker and is intended to be operated with a pragmatic DevOps workflow.

## Decision

Adopt a **hybrid model**: **BullMQ workers** for reliable job dispatch + **n8n** for external workflow orchestration.

### BullMQ (Redis-backed job queues)

Two dedicated queues and workers are now active:

1. **`reminders` queue** (`pnpm worker:reminders`):
   - Processes scheduled reminders.
   - Dispatches to n8n webhook for actual delivery (email, push, etc.).
   - HMAC-signed webhook payloads.

2. **`summaries` queue** (`pnpm worker:summaries`):
   - Processes entry summary requests.
   - Dispatches to n8n webhook for LLM processing.
   - n8n calls back to the app with results (HMAC-signed callback).

Workers implement:

- `QueuePort` interface in Application layer (clean architecture boundary).
- `BullMQAdapter` in Infrastructure layer (concrete implementation).
- Idempotent job processing with stable identifiers.

### n8n (Workflow orchestration)

n8n handles external processing that the app delegates:

- Receives webhook triggers from BullMQ workers.
- Executes LLM calls, email delivery, and other external integrations.
- Calls back to the app API with results (HMAC-signed).

### Communication flow

```
App API → BullMQ (enqueue job)
BullMQ Worker → n8n webhook (HMAC-signed)
n8n processes → App API callback (HMAC-signed)
App API → Update DB + create notification
```

### Security

- All webhook communication uses **HMAC signatures** (`X-Signature` + `X-Timestamp` headers).
- Callbacks are verified in the API route handler before processing.
- `N8N_WEBHOOK_SECRET` is shared between the app and n8n.

## Consequences

### Positive

- Reliable: BullMQ provides retries, backoff, and persistence via Redis.
- Observable: Job status tracked in DB + n8n execution logs + Redis queue metrics.
- Separation of concerns: app enqueues work, workers dispatch, n8n orchestrates externals.
- Rapid iteration: n8n workflows can be modified without code changes.

### Negative / Trade-offs

- Requires Redis + n8n services running alongside the app.
- HMAC secrets must be coordinated between app and n8n.
- Workflow logic in n8n must be versioned/managed to avoid "hidden business logic."

## Alternatives Considered

1. **n8n-only (no BullMQ)**
   - Original proposal. Evolved to hybrid as reliable queueing became important for reminders and summaries.
2. **BullMQ-only (no n8n)**
   - Considered: would require coding all external integrations in workers. n8n provides faster iteration for LLM/email/notification flows.
3. **Postgres-based worker system (pg-boss/Graphile Worker)**
   - Considered: simpler, but BullMQ was already integrated and Redis was available.

## Implementation Notes

- Workers run as separate Node.js processes (`tsx src/infrastructure/queue/reminderWorker.ts`).
- `BullMQAdapter` implements `QueuePort` from the Application layer.
- `N8NClient` in Infrastructure handles webhook dispatch with HMAC signing.
- Callbacks land on `POST /api/automations/entry-summary/callback` (and similar routes).
- Use idempotency keys for callbacks to avoid double-apply on retries.
