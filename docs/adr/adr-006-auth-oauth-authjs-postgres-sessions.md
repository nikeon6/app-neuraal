# ADR-006: Authentication: OAuth with Auth.js (NextAuth) + Postgres Sessions

- **Status:** Proposed
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — architecture decision

---


## Context

Neuraal is a **multi-user** application and requires authentication via **OAuth** providers.
The system must be secure by default and avoid custom credential handling when not necessary.
We also want the authentication layer to integrate well with Next.js and the chosen persistence layer (Postgres).

Key requirements:
- OAuth sign-in (e.g., Google/GitHub)
- Server-side enforcement of authorization (per user/tenant ownership)
- Session management that works in a Next.js environment
- Minimal custom security surface

## Decision

Use **Auth.js (NextAuth)** for OAuth authentication with a **Postgres-backed session store** (via an official adapter).

- Prefer **database sessions** (stored in Postgres) over long-lived JWT-only sessions.
- Use secure cookies configured by the framework; ensure HTTPS-only cookies in production.
- Persist identity links using:
  - `users`
  - `accounts` (provider accounts)
  - `sessions` (active sessions)

Authorization rules:
- Enforce access control in server routes/handlers for every protected action.
- All user-owned entities (e.g., tasks, topics, attachments, AI jobs) must include `ownerId` (or `tenantId`) and be filtered/checked server-side.

## Consequences

### Positive
- Proven OAuth and session management, less custom security code.
- Session invalidation and server-side control via database sessions.
- Easier multi-device support.

### Negative / Trade-offs
- Requires DB connectivity for session checks.
- Some framework conventions to learn (callbacks, adapters).

## Alternatives Considered

1. Custom OAuth implementation
   - Rejected: increases security surface and maintenance.
2. JWT-only sessions (stateless)
   - Considered: simpler infra, but harder revocation and more careful token management required.

## Implementation Notes

- Configure provider scopes to the minimum needed.
- Add audit logging for auth events where relevant.
- Consider a future `tenantId` abstraction if organizations/workspaces are introduced.
