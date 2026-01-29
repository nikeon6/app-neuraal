# ADR-008: Automation & Async Workflows: n8n-Orchestrated Jobs (Queue Optional Later)

- **Status:** Proposed
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — architecture decision

---


## Context

Neuraal requires asynchronous workflows such as:
- Scheduled notifications/messages at a user-defined `sendAt` time.
- Long-running AI tasks (e.g., OpenAI Batch API) where results arrive minutes later.
- Potential background processing (retries, callbacks, status updates).

The project will run in Docker and is intended to be operated with a pragmatic DevOps workflow.
The team plans to use **n8n** to build automation and AI flows quickly.

## Decision

Adopt an **n8n-first orchestration** model for async workflows:

1. Represent async work in Postgres via `jobs` tables (e.g., `ai_jobs`, `notification_jobs`) with:
   - `status` (queued/processing/done/failed)
   - `payload`
   - `result` (or reference)
   - timestamps
2. Trigger n8n workflows via webhooks from the application server.
3. For scheduled notifications:
   - n8n uses “wait until” functionality to delay execution until `sendAt`.
   - n8n executes the send action and calls back to the app to mark completion.
4. For OpenAI Batch:
   - n8n submits batch, stores `batchId`, polls/awaits completion, and calls back with results.

Queue system (BullMQ/Redis/worker) is **optional** and introduced only if:
- Scheduling volume grows beyond n8n suitability,
- More control over retries/priority/rate limits is required,
- Operational monitoring of background tasks needs dedicated tooling.

## Consequences

### Positive
- Rapid iteration: workflows are created/updated without deep code changes.
- Async tasks are observable via DB job status + n8n execution logs.
- Avoids introducing Redis/worker complexity prematurely.

### Negative / Trade-offs
- Requires careful n8n configuration so waits survive restarts (persistence).
- Workflow logic must be versioned/managed to avoid “hidden business logic.”

## Alternatives Considered

1. BullMQ/Redis + custom workers from day one
   - Rejected for v1: more infra and code; can be added later if needed.
2. Postgres-based worker system only (pg-boss/Graphile Worker)
   - Considered: good simplification, but n8n already covers orchestration needs.

## Implementation Notes

- Treat n8n workflows as part of the system: document inputs/outputs and callbacks.
- Secure webhook endpoints (signed secrets, allowlists, or HMAC signatures).
- Use idempotency keys for callbacks to avoid double-apply on retries.
