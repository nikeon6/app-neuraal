# ADR-011: AI Guardrails and Usage Tracking

- **Status:** Accepted
- **Date:** 2026-02-10
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — responsible AI feature usage

---

## Context

Neuraal exposes multiple AI-powered features (summaries, YouTube transcription, OCR, WhatsApp reminders) that consume external resources (Ollama inference, n8n workflows). Without controls, a single user could exhaust server resources or incur unbounded costs. The system needs per-user guardrails that are configurable, observable, and enforceable without modifying individual use cases.

## Decision

Implement a centralized AI guardrails system with four protection layers, applied uniformly before any AI action executes:

1. **Rate limiting** (per-minute and per-hour): Redis-backed fixed-window counters prevent burst abuse. Configurable per action via environment variables.
2. **Concurrency limiting**: Redis-backed per-user concurrency limiter prevents multiple simultaneous requests of the same type.
3. **Monthly quotas**: Database-tracked counters (`AiUsageMonthly` table) enforce monthly request caps per action. Quotas reset automatically each month.
4. **Input size limits**: Per-action maximum input characters (text) or bytes (images) validated before processing.

### Implementation

- `GuardAiAction` use case: Validates all four layers before allowing an AI action. Returns a typed error (`RATE_LIMITED`, `QUOTA_EXCEEDED`, `INPUT_TOO_LARGE`, `CONCURRENCY_EXCEEDED`) or success.
- `ConsumeAiRequest` use case: Deducts from the monthly quota after the guardrail passes. Creates a `AiUsageLedger` entry for audit.
- `AiGuardrailsConfig`: Environment-variable-driven configuration with sensible defaults per action.
- Usage visible to users via `GET /api/ai/usage` and the Settings section in the UI.

### Default Limits

| Action                | Rate/min | Rate/hour | Concurrency | Monthly Quota | Input Limit  |
| --------------------- | -------- | --------- | ----------- | ------------- | ------------ |
| Summary               | 5        | 30        | 1           | 100 requests  | 12,000 chars |
| YouTube Transcription | 3        | -         | 1           | 50 requests   | 12,000 chars |
| OCR                   | 5        | -         | 1           | 200 requests  | 4 MB         |
| WhatsApp Reminder     | 5        | -         | 50          | 200 requests  | 500 chars    |

## Consequences

### Positive

- Prevents resource abuse without per-feature implementation burden.
- Configurable via environment variables; no code changes needed to adjust limits.
- Full audit trail via `AiUsageLedger` for cost analysis and anomaly detection.
- Users have visibility into their usage and remaining quotas.

### Negative / Trade-offs

- Adds latency (Redis + DB checks) before each AI action.
- Monthly quota tracking requires database writes on every AI request.
- Configuration surface is large (4 actions x multiple parameters).

## References

- `src/application/use-cases/ai/GuardAiAction.ts`
- `src/application/use-cases/ai/ConsumeAiRequest.ts`
- `src/infrastructure/config/AiGuardrailsConfig.ts`
- `src/infrastructure/redis/RedisRateLimiter.ts`
- `src/infrastructure/redis/RedisConcurrencyLimiter.ts`
