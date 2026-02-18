# ADR-002: State Management Strategy (Feature-Scoped First)

- **Status:** Proposed
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — foundational architecture decision

---

## Context

Neuraal’s UI has interactive components (topic bubbles/anchors, calendar views) where:

- Much state is local to a feature (positions, layout, UI transitions)
- Some state may later become cross-cutting (selected topic, global filters, user session)

We want a strategy that:

- Keeps state as local as possible
- Avoids a global “god store”
- Is easy to test and reason about

## Decision

Adopt a **feature-scoped-first** strategy:

1. Prefer **React local state** (`useState`, `useReducer`) and feature hooks for UI state that does not need to be global.
2. If state must be shared across many components _within the same feature_, use a **feature-level Context** (e.g., `TopicsProvider`).
3. Only introduce a lightweight external store (e.g., **Zustand**) if:
   - State must be shared across features, or
   - Performance or prop-drilling becomes a clear problem

**Rule of thumb:** local → feature context → external store (only when justified).

## Consequences

### Positive

- Lower complexity early; state is close to where it’s used.
- Easier testing (reducers/hooks as pure logic).
- Prevents over-engineering.

### Negative / Trade-offs

- Might require refactoring if cross-feature needs grow.
- Mixed approaches require clear guidelines and documentation.

## Alternatives Considered

1. **Global store from day one** (Redux/Zustand everywhere)
   - Rejected: encourages over-centralization and increases complexity.
2. **Only Context everywhere**
   - Rejected: can cause rerender issues and awkward composition at scale.

## Implementation Notes

- If/when Zustand is introduced, keep stores **feature-owned** unless truly global.
- Prefer “derived state” computed from source-of-truth rather than storing duplicates.
