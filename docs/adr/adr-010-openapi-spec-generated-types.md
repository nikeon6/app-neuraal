# ADR-010: OpenAPI Specification as Source of Truth + Generated TypeScript Types

- **Status:** Accepted
- **Date:** 2026-01-29
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — API documentation and type safety

---

## Context

The Neuraal backend exposes a REST API via Next.js route handlers. As the API surface has grown (topics, entries, reminders, notifications, summaries, attachments, embeddings, automations), keeping frontend types in sync with backend responses has become error-prone.

We need:
- A single source of truth for the API contract.
- Automatic TypeScript type generation for the frontend API client.
- Runtime access to the spec for tooling and debugging.
- Preparation for the auth transition from `x-user-id` (dev) to JWT (production).

## Decision

Adopt an **OpenAPI 3.1 spec-first** approach:

1. **`openapi/spec.ts`**: Hand-maintained TypeScript file exporting the full OpenAPI 3.1 spec object. This is the source of truth.
2. **`openapi/openapi.json`**: Generated JSON file (`pnpm openapi:emit`), used as input for type generation.
3. **`src/shared/api/openapi-types.ts`**: Auto-generated TypeScript types (`pnpm openapi:types` via `openapi-typescript`).
4. **`GET /api/openapi.json`**: Runtime endpoint serving the spec as JSON (no auth required).
5. **`pnpm openapi:generate`**: Single command to regenerate both JSON and types.

### Spec coverage

Documents all existing API endpoints (16+ operations), including:
- Request/response schemas for all CRUD operations.
- Security schemes: `DevUserIdHeader` (current) + `BearerAuth` (future JWT).
- Tags for logical grouping (Topics, Entries, Reminders, Notifications, Automations, Embeddings).
- Reusable component schemas (Topic, Entry, Reminder, Notification, Attachment, ErrorResponse).

### Update workflow

When adding or modifying an API endpoint:
1. Update `openapi/spec.ts` in the same PR.
2. Run `pnpm openapi:generate` to regenerate JSON + types.
3. Commit the generated files.

## Consequences

### Positive
- Single source of truth eliminates type drift between frontend and backend.
- Generated types catch breaking changes at compile time.
- Runtime endpoint enables future Swagger UI, Redoc, or API testing tools.
- Low overhead: `openapi-typescript` generates types with zero runtime cost.
- Security schemes document the auth transition path clearly.

### Negative / Trade-offs
- Spec must be manually kept in sync with route handlers (no code-gen from routes).
- Generated files (`openapi.json`, `openapi-types.ts`) are committed to the repo, adding diff noise.
- OpenAPI 3.1 is newer; some tools may lag behind in support.

## Alternatives Considered

1. **Code-first with decorators (tsoa, nestjs-swagger)**
   - Rejected: requires decorators on route handlers, tighter coupling, and doesn't fit Next.js App Router pattern.
2. **No spec; manually maintain shared types**
   - Rejected: doesn't scale, no runtime introspection, no tooling benefits.
3. **GraphQL**
   - Out of scope: the project uses REST and is too far along to switch.
4. **Swagger UI / Redoc integration**
   - Deferred: not needed for MVP; the JSON endpoint is sufficient for now.

## Implementation Notes

- `openapi/spec.ts` uses `as const` and `String.raw` for regex patterns to satisfy the linter.
- `scripts/openapi/emit.ts` uses `tsx` for TypeScript execution.
- `openapi-typescript` v7+ generates types compatible with the `fetch` API client in `src/shared/api/apiClient.ts`.
- The spec serves as documentation for the centralized API client (`apiFetch`, `get`, `post`, `patch`, `del` helpers).
