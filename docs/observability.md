# Observability Guide

## Overview

This document describes the observability stack for the Neuraal application.

## Structured Logging (pino)

All logs are structured JSON in production, pretty-printed in development.

### API Requests

Every API request generates:
- `request.start` — method, route, requestId
- `request.end` — status, durationMs, requestId

The `x-request-id` header is:
- Read from incoming request if present (forwarded by reverse proxy)
- Generated as UUID if absent
- Returned in the response header

### Workers (BullMQ)

Each job logs:
- `job.start` — jobId, queue, action, payload identifiers
- `job.success` or `job.outcome_failed` — durationMs, status
- `job.failed` (event) — error details

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |
| `NODE_ENV` | — | Controls pretty-printing (non-production = pretty) |

### Sensitive Data

The following fields are automatically redacted:
`password`, `passwordHash`, `tokenHash`, `refreshToken`, `accessToken`, `secret`, `authorization`, `cookie`

---

## Sentry (Error Tracking)

### Setup

| Env var | Required | Description |
|---------|----------|-------------|
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN (no DSN = Sentry disabled) |
| `SENTRY_ENVIRONMENT` | No | `development`, `staging`, `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` (prod), `1.0` (dev) |
| `SENTRY_RELEASE` | No | Git SHA or version tag |
| `SENTRY_AUTH_TOKEN` | No | For source map upload |

### Where errors are captured

- **API routes**: via `withApiContext` wrapper — captures unhandled errors with `requestId` and `route` tags
- **Workers**: via `captureWorkerException` — captures job failures with `queue`, `jobId`, `action` tags
- **Client-side**: automatic React error boundary capture

### Recommended Sentry Alerts

Create these alerts in the Sentry dashboard:
1. **High error rate**: > 10 errors in 5 min
2. **Job failures**: events with tag `queue:*`
3. **Guardrail spikes**: 429/403 response status spikes
4. **New issues**: alert on first occurrence of new error types

---

## Prometheus Metrics

### Endpoint

```
GET /api/metrics
```

Protected by `METRICS_TOKEN` env var (bearer auth). If not set, accessible without auth.

```bash
# Without auth (dev)
curl http://localhost:3000/api/metrics

# With auth (prod)
curl -H "Authorization: Bearer $METRICS_TOKEN" https://app.example.com/api/metrics
```

### Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `neuraal_http_request_duration_seconds` | Histogram | route, method, status | Request duration |
| `neuraal_http_requests_total` | Counter | route, method, status | Total requests |
| `neuraal_ai_requests_blocked_total` | Counter | action, reason | Blocked by guardrails |
| `neuraal_ai_requests_accepted_total` | Counter | action | Passed guardrails |
| `neuraal_bull_jobs_total` | Counter | queue, status | Jobs processed |
| `neuraal_bull_job_duration_seconds` | Histogram | queue, status | Job duration |
| `neuraal_*` (default) | Various | — | Node.js default metrics |

### Grafana Integration

Point a Prometheus scraper at `/api/metrics` and import dashboards for:
- HTTP request rate and latency
- Error rate by route
- Job throughput and failure rate
- AI guardrail block rate

---

## Healthcheck

```
GET /api/health
```

Returns status of all critical dependencies:

```json
{
  "status": "ok",
  "checks": {
    "db": { "ok": true, "latencyMs": 3 },
    "redis": { "ok": true, "latencyMs": 1 },
    "ollama": { "ok": true, "latencyMs": 45 },
    "n8n": { "ok": true, "latencyMs": 12 },
    "s3": { "ok": true, "latencyMs": 8 }
  },
  "timestamp": "2026-02-12T19:00:00.000Z"
}
```

Response codes:
- `200` — all checks pass (`ok`) or non-critical degraded (`degraded`)
- `503` — critical service down (`down`)

Optional checks (only run if env var is set):
- Ollama: `OLLAMA_BASE_URL`
- n8n: `N8N_BASE_URL`
- S3/MinIO: `S3_ENDPOINT`

---

## Bull Board (Queue Monitor)

### Setup

```bash
pnpm monitor:queues
```

Opens a web UI at `http://localhost:3001` (default port).

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `BULLBOARD_PORT` | `3001` | Server port |
| `BULLBOARD_USER` | `admin` | Basic auth username |
| `BULLBOARD_PASSWORD` | (empty) | Basic auth password (set in production!) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |

### Docker Compose

Add to `docker-compose.yml` for production:

```yaml
bullboard:
  build: .
  command: pnpm monitor:queues
  ports:
    - "3001:3001"
  environment:
    - REDIS_URL=redis://redis:6379
    - BULLBOARD_USER=admin
    - BULLBOARD_PASSWORD=${BULLBOARD_PASSWORD}
```
