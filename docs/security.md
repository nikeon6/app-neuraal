# Neuraal — Security Documentation

**Last updated:** 2026-02-18

This document describes the security measures implemented in Neuraal, covering authentication, authorization, rate limiting, webhook verification, security headers, AI guardrails, and sensitive data handling.

---

## 1. Authentication (JWT)

Neuraal uses a stateless JWT-based authentication system with token rotation and reuse detection.

### Token Architecture

| Token             | Storage                          | TTL                       | Purpose                    |
| ----------------- | -------------------------------- | ------------------------- | -------------------------- |
| **Access token**  | httpOnly cookie (`accessToken`)  | 15 minutes (configurable) | Authenticates API requests |
| **Refresh token** | httpOnly cookie (`refreshToken`) | 30 days (configurable)    | Mints new access tokens    |

### Token Lifecycle

1. **Login** (`POST /api/auth/login`): Validates credentials, issues access + refresh tokens as httpOnly cookies.
2. **API requests**: Access token is automatically sent via cookies. Server verifies signature and expiry with `jose`.
3. **Refresh** (`POST /api/auth/refresh`): Issues new access + refresh tokens. Old refresh token is revoked and linked to the new one (`replacedById`).
4. **Logout** (`POST /api/auth/logout`): Revokes the current refresh token.

### Token Rotation

On each refresh, the old refresh token is revoked and a new one is issued. The old token's `replacedById` field points to the new token, forming a chain.

### Reuse Detection

If a revoked refresh token is presented (indicating potential token theft), the system revokes **all** refresh tokens for that user, forcing re-authentication on all devices.

### Cookie Attributes

| Attribute  | Value                                      |
| ---------- | ------------------------------------------ |
| `httpOnly` | `true` (prevents JavaScript access)        |
| `secure`   | `true` in production (HTTPS only)          |
| `sameSite` | `lax` (prevents CSRF on cross-origin POST) |
| `path`     | `/`                                        |

### Dev Fallback

In non-production environments (`NODE_ENV !== 'production'`), an `x-user-id` header is accepted as fallback authentication if no JWT cookie is present. This simplifies API testing during development.

### Implementation

- `src/infrastructure/auth/JoseJwtService.ts` — JWT signing and verification using `jose`.
- `src/infrastructure/auth/AuthCookies.ts` — Cookie creation and extraction.
- `src/infrastructure/auth/CryptoRefreshTokenService.ts` — Cryptographically random token generation, SHA-256 hashing.
- `src/infrastructure/auth/AuthConfig.ts` — Environment-variable-driven configuration.

---

## 2. Password Security

### Password Policy

All passwords must satisfy:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

Validated via the `Password` value object in the domain layer.

### Password Hashing

- **Algorithm**: bcrypt via `bcryptjs`
- **Salt rounds**: 12
- **Implementation**: `src/infrastructure/auth/BcryptPasswordHasher.ts`

### Password Recovery

1. User requests recovery (`POST /api/auth/recover`) with their email.
2. System generates a cryptographically random token, hashes it (SHA-256), and stores the hash with a 1-hour expiry.
3. Token is sent to the user (in production, via email; in dev, returned in the response).
4. User submits the token + new password (`POST /api/auth/reset-password`).
5. System verifies the token hash, checks expiry, updates the password, and marks the token as used.

---

## 3. Rate Limiting

### Login Rate Limiting

- **Mechanism**: In-memory counter per IP address.
- **Threshold**: 5 failed login attempts.
- **Lockout**: 5-minute cooldown period.
- **Scope**: Per IP address (not per user).
- **Implementation**: `src/infrastructure/auth/LoginRateLimiter.ts`

### AI Feature Rate Limiting

- **Mechanism**: Redis-backed fixed-window counters.
- **Scope**: Per user, per AI action.
- **Windows**: Per-minute and per-hour (configurable per action).
- **Implementation**: `src/infrastructure/redis/RedisRateLimiter.ts`

### AI Concurrency Limiting

- **Mechanism**: Redis-backed per-user concurrency counter.
- **Purpose**: Prevents multiple simultaneous AI requests from the same user.
- **Implementation**: `src/infrastructure/redis/RedisConcurrencyLimiter.ts`

---

## 4. Webhook Security (HMAC)

Communication between Neuraal and n8n uses HMAC-SHA256 signature verification.

### Outbound (Neuraal -> n8n)

The `N8NClient` signs every webhook request:

1. Generate current timestamp (ISO 8601).
2. Compute HMAC-SHA256: `HMAC(secret, timestamp + "." + body)`.
3. Send headers: `X-Timestamp` and `X-Signature`.

### Inbound (n8n -> Neuraal)

Automation callback endpoints verify incoming requests:

1. Extract `X-Signature` and `X-Timestamp` headers.
2. Validate timestamp is within +-5 minutes (prevents replay attacks).
3. Recompute HMAC and compare with the provided signature.
4. Reject with `401 Unauthorized` on any verification failure.

### Implementation

- `src/infrastructure/automation/N8NClient.ts` — Outbound signing.
- `src/app/api/automations/*/callback/route.ts` — Inbound verification.

---

## 5. Security Headers

Applied to all routes via `next.config.ts`:

| Header                      | Value                                          | Purpose                           |
| --------------------------- | ---------------------------------------------- | --------------------------------- |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevents MIME-type sniffing       |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Controls referrer information     |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Disables unnecessary browser APIs |
| `X-Frame-Options`           | `DENY`                                         | Prevents clickjacking             |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS (production only)    |

### Implementation

`next.config.ts` — Security headers applied to all routes via `async headers()`.

---

## 6. AI Guardrails

All AI features are protected by a centralized guardrails system (see [ADR-011](adr/adr-011-ai-guardrails-usage-tracking.md)):

| Protection Layer | Mechanism                                 | Storage                       |
| ---------------- | ----------------------------------------- | ----------------------------- |
| Rate limiting    | Fixed-window counters (per-min, per-hour) | Redis                         |
| Concurrency      | Per-user active request counter           | Redis                         |
| Monthly quotas   | Request counters per action per month     | PostgreSQL (`AiUsageMonthly`) |
| Input size       | Character/byte limits per action          | In-memory validation          |

### Audit Trail

Every AI request creates an `AiUsageLedger` entry recording: user, action, model, token counts, and cost estimation.

---

## 7. Authorization

### Server-Side Enforcement

- Every protected API route extracts the user ID from the JWT.
- All database queries are scoped to the authenticated user (`WHERE userId = ?`).
- No client-side-only authorization checks.

### HTTP Status Codes

| Code               | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| `401 Unauthorized` | Missing or invalid authentication                              |
| `403 Forbidden`    | Authenticated but insufficient permissions                     |
| `404 Not Found`    | Resource not found or not owned by user (prevents enumeration) |

---

## 8. Sensitive Data Handling

### Structured Logging (pino)

- Auto-redaction of sensitive fields: `password`, `token`, `secret`, `authorization`, `cookie`.
- Request IDs propagated for traceability without exposing user data.
- No PII in log messages beyond user ID.

### Sentry

- Error reports sanitized to exclude authentication tokens and passwords.
- Session replay configured with privacy-aware settings.
- User context limited to anonymized identifiers.

### Environment Variables

- All secrets stored in environment variables (never hardcoded).
- `.env` files excluded from version control via `.gitignore`.
- Production secrets managed via CI/CD secrets (GitHub Actions).

---

## 9. OWASP Top 10 Alignment

| OWASP Risk                         | Mitigation                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| **A01: Broken Access Control**     | Server-side user-scoped queries; JWT enforcement on all protected routes                           |
| **A02: Cryptographic Failures**    | Bcrypt password hashing; JWT signing with HS256; secrets in env vars; HTTPS in production          |
| **A03: Injection**                 | Prisma parameterized queries; no raw SQL with user input; input validation via value objects       |
| **A04: Insecure Design**           | Clean Architecture with explicit security boundaries; rate limiting; AI guardrails                 |
| **A05: Security Misconfiguration** | Security headers; no verbose errors in production; minimal Docker runtime image                    |
| **A06: Vulnerable Components**     | Automated dependency updates; pnpm lockfile for reproducible builds                                |
| **A07: Auth Failures**             | Strong password policy; login rate limiting; token rotation; reuse detection                       |
| **A08: Data Integrity Failures**   | HMAC webhook verification; optimistic concurrency on entries and stickies                          |
| **A09: Logging Failures**          | Structured logging (pino); Sentry error tracking; Prometheus metrics; security event logging       |
| **A10: SSRF**                      | No user-controlled URLs passed to server-side fetchers (Ollama and n8n URLs are server-configured) |

---

## 10. Future Considerations

- **CSRF tokens**: Currently mitigated by `SameSite=Lax` cookies. Consider adding explicit CSRF tokens if cross-origin POST flows are needed.
- **Content Security Policy (CSP)**: Not yet implemented. Should be added for production to prevent XSS via inline scripts.
- **Dependency scanning**: Consider integrating Snyk or Dependabot for automated vulnerability scanning.
- **Penetration testing**: Recommended before production launch.
