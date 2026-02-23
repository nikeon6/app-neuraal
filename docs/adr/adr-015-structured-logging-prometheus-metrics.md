# ADR-015: Structured Logging (pino) + Prometheus Metrics

- **Status:** Accepted
- **Date:** 2026-02-15
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — observability beyond error tracking

---

## Context

While Sentry (ADR-005) handles error tracking and performance monitoring, the application also needs:

- Structured, machine-readable logs for debugging and audit trails in production.
- Request-scoped context (request ID, user ID) propagated through all log entries.
- Automatic redaction of sensitive fields (passwords, tokens, secrets) from log output.
- Application-level metrics (request counts, durations, queue depths) for operational dashboards.
- Worker observability: BullMQ workers run as separate processes and need their own logging and metrics.

## Decision

### Structured Logging: pino

Use **pino** as the structured JSON logger across all layers:

- `src/infrastructure/logging/` contains the logger factory.
- JSON output in production; human-readable output (via `pino-pretty`) in development.
- **Auto-redaction**: Configured redact paths for sensitive fields (`password`, `token`, `secret`, `authorization`, `cookie`, etc.) so they never appear in log output.
- **Request context**: `src/infrastructure/http/requestContext.ts` provides a per-request logger with `requestId` and `userId` injected into every log entry via `withApiContext`.
- Workers use the same pino configuration for consistent log format.

### Application Metrics: Prometheus (prom-client)

Use **prom-client** to expose Prometheus-compatible metrics:

- `src/infrastructure/metrics/` defines counters and histograms.
- Metrics exposed via `GET /api/metrics` endpoint.
- Key metrics:
  - HTTP request count and duration (by method, path, status)
  - BullMQ job processing count and duration (by queue, status)
  - AI action usage (by action type)
  - Authentication events (login success/failure)

### Integration

- API route handlers are wrapped with `withApiContext` which provides both request logging and metric collection.
- Workers emit structured logs and increment job counters on completion/failure.

## Consequences

### Positive

- Consistent, searchable log format across API and workers.
- Sensitive data never leaks into logs (redaction is automatic, not opt-in).
- Request ID correlation enables end-to-end request tracing.
- Prometheus metrics enable alerting and dashboards (Grafana or similar).
- Low overhead: pino is the fastest Node.js logger.

### Negative / Trade-offs

- Adds `pino`, `pino-pretty`, and `prom-client` dependencies.
- Prometheus endpoint must be protected in production (or exposed only to internal network).
- Redaction paths must be maintained as new sensitive fields are introduced.

## Alternatives Considered

1. **Winston** — Rejected: slower than pino, more complex configuration.
2. **console.log with JSON.stringify** — Rejected: no redaction, no request context, no child loggers.
3. **OpenTelemetry for metrics** — Considered: more powerful but heavier; prom-client is sufficient for the current scale.
4. **Sentry-only for all observability** — Rejected: Sentry is for errors and transactions, not structured application logs or time-series metrics.

## References

- `src/infrastructure/logging/`
- `src/infrastructure/metrics/`
- `src/infrastructure/http/requestContext.ts`
- `src/infrastructure/http/withApiContext.ts`
