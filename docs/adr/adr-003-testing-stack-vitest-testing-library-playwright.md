# ADR-003: Testing Stack: Vitest + Testing Library + Playwright

- **Status:** Accepted
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — foundational architecture decision

---

## Context

The project needs a CI-friendly testing stack that supports:

- Fast unit tests for domain/application logic
- Component tests for feature UI
- A small number of stable end-to-end tests for critical flows

We also want good TypeScript support and ergonomics in a Next.js codebase.

## Decision

Use the following tools:

- **Unit / Integration:** Vitest
- **UI Testing:** Testing Library (`@testing-library/react`)
- **E2E:** Playwright

Adopt a pyramid strategy:

1. Many unit tests (pure logic, reducers, utilities)
2. Some integration tests (feature components + providers)
3. Few E2E tests (critical journeys)

## Consequences

### Positive

- Fast feedback locally and in CI.
- Great DX in TypeScript.
- Strong E2E reliability with Playwright.

### Negative / Trade-offs

- Two different test runners (Vitest vs Playwright).
- Requires discipline to keep E2E tests minimal and stable.

## Alternatives Considered

1. **Jest everywhere**
   - Rejected: slower, heavier config for modern Vite-based tooling.
2. **Cypress for E2E**
   - Rejected: Playwright generally provides stronger cross-browser control.

## Implementation Notes

- Keep E2E tests focused on happy paths and critical flows.
- Avoid snapshot-heavy UI tests; prefer user-centric queries and assertions.
- Enforce consistent coverage goals for core logic (not type-only files).
