# ADR-001: Next.js App Router + Feature-First Project Structure

- **Status:** Accepted
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — foundational architecture decision

---

## Context

Neuraal is a responsive Next.js application with two core feature areas already emerging in the codebase:

- `topics` (interactive topic bubbles / anchors and related UI state)
- `calendar` (calendar-like UI with derived display values)

The project needs a structure that:

- Scales as features grow
- Keeps UI state and UI-specific types **inside** their feature boundaries
- Enables testability and clean dependency direction (Clean Architecture-inspired)

## Decision

1. Use **Next.js App Router** (`src/app`) for routing/layout.
2. Organize UI code by **features** under `src/features/*`.
3. Keep **UI-only types** (view models, UI state, positions/layout) **inside** each feature:
   - `src/features/topics/types.ts`
   - `src/features/calendar/types.ts`
4. Reserve `src/shared/types` for **domain-level** types only (not UI state).

Proposed target layout:

```
src/
  app/
  features/
    topics/
      components/
      hooks/
      types.ts
    calendar/
      components/
      hooks/
      types.ts
  shared/
    types/       # domain types only
    utils/
  domain/
  application/
  infrastructure/
docs/
  adr/
```

## Consequences

### Positive

- Clear boundaries: feature UI state stays close to its UI.
- Reduced coupling and fewer circular dependencies.
- Better testability and refactor safety.

### Negative / Trade-offs

- Some duplicated “glue” code across features (acceptable for clarity).
- Requires discipline to prevent `shared/` from becoming a dumping ground.

## Alternatives Considered

1. **Type-first shared folder** (many UI types in `shared/`)
   - Rejected: leads to “shared UI state soup” and unclear ownership.
2. **Layer-first only** (all UI in one folder, all types in another)
   - Rejected: hurts feature encapsulation and discoverability.

## Notes

- Avoid barrel file antipatterns that hide dependencies and can increase bundle size or create circular imports.
