# ADR-005: Observability: Sentry for Errors and Performance Monitoring

- **Status:** Accepted
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — foundational architecture decision

---


## Context

The project needs production-grade visibility into:
- Unhandled errors (frontend and backend)
- Performance bottlenecks and slow transactions
- Optional session replay to debug UX issues

We want a tool with good Next.js support and minimal operational overhead.

## Decision

Adopt **Sentry** for:
- Error tracking
- Performance monitoring (transactions/spans)
- Optional session replay (with privacy controls)

Integrate Sentry in:
- Next.js app (client)
- Next.js server routes / route handlers

## Consequences

### Positive
- Faster debugging and improved reliability.
- Visibility into real-user performance.
- Centralized issue tracking.

### Negative / Trade-offs
- Additional dependency and configuration.
- Must ensure PII is not captured (scrubbing + privacy settings).

## Alternatives Considered

1. **No centralized monitoring**
   - Rejected: issues become hard to diagnose and measure.
2. **Self-hosted APM/logging stack**
   - Rejected for v1: heavier ops and setup cost.

## Implementation Notes

- Use environment-based config:
  - enable performance sampling in production with a sensible rate
  - disable session replay or increase masking if needed
- Add release tracking to correlate errors with deployments.
