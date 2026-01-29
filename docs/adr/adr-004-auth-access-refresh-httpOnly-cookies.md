# ADR-004: Authentication: Access/Refresh Tokens via httpOnly Cookies

- **Status:** Proposed
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — foundational architecture decision

---


## Context

If authentication is enabled, the app needs a secure approach that:
- Minimizes XSS token exfiltration risk
- Supports short-lived access tokens for safety
- Refreshes sessions without frequent re-login
- Works well with Next.js Route Handlers / API routes

## Decision

Use a two-token approach:

- **Access token**: short-lived (e.g., 10–20 minutes)
- **Refresh token**: longer-lived (e.g., 7–30 days), used only to mint a new access token

Store both tokens in **httpOnly cookies** (not localStorage/sessionStorage).
Implement refresh token rotation on each refresh.

Endpoints (example):
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Cookie flags:
- `httpOnly: true`
- `secure: true` (production)
- `sameSite: 'lax'` or `'strict'` depending on cross-site needs
- `path` scoped appropriately

## Consequences

### Positive
- Strong protection against XSS token theft (httpOnly).
- Access tokens expire quickly, limiting exposure window.
- Refresh rotation reduces replay risk.

### Negative / Trade-offs
- Requires CSRF considerations (mitigated via SameSite + CSRF token if needed).
- More backend logic (refresh + rotation + invalidation).

## Alternatives Considered

1. **LocalStorage JWT**
   - Rejected: high risk of theft via XSS.
2. **Server session store only**
   - Considered: simpler revocation, but adds server state and scaling concerns.

## Implementation Notes

- For CSRF-sensitive flows, add a CSRF token (double-submit cookie or header).
- Rate-limit auth endpoints.
- Log security events (failed logins, token refresh anomalies).
