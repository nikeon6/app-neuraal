# ADR-016: TanStack Query for Server State Management

- **Status:** Accepted
- **Date:** 2026-02-21
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — frontend data fetching and caching strategy

---

## Context

As the backend API was implemented (entries, topics, reminders, notifications, stickies, attachments, AI features), the frontend needed a robust strategy for:

- Fetching, caching, and synchronizing server data across components.
- Automatic cache invalidation when mutations occur.
- Background refetching to keep data fresh without manual polling logic.
- Handling loading, error, and stale states consistently.
- Reacting to async notifications (summaries, transcriptions, reminders) to auto-refresh relevant queries.

The Zustand store (ADR-002) was already in place for UI-only state (date selection, topic positions, dashboard section), but mixing server data into Zustand would violate the separation of concerns and duplicate caching logic.

## Decision

Adopt **TanStack Query** (`@tanstack/react-query` v5) as the server state manager, keeping Zustand exclusively for UI state.

### Architecture

- **Zustand** manages UI state: selected date, topic positions, dashboard section, scroll targets.
- **TanStack Query** manages all server data: entries, topics, reminders, notifications, stickies, AI usage, storage usage, weekly recap.

### Query hooks

All query hooks live in `src/shared/api/queries/` with a consistent pattern:

```typescript
export function useEntriesByDateQuery(dateKey: string) {
  return useQuery({
    queryKey: entriesQueryKey(dateKey),
    queryFn: () => sdk.entries.getByDate(dateKey),
    staleTime: 30_000,
  });
}
```

### Mutation + invalidation pattern

Mutations (create, update, delete) use `useMutation` with `onSuccess` callbacks that invalidate relevant query keys:

```typescript
const mutation = useMutation({
  mutationFn: (patch) => sdk.entries.update(entryId, patch),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
  },
});
```

### Notification watchers

For async operations (summaries, transcriptions, reminders), watcher hooks poll the notifications query and automatically invalidate relevant queries when completion notifications arrive:

- `useSummaryDoneWatcher(dateKey)` → invalidates `entriesQueryKey(dateKey)`
- `useTranscriptionDoneWatcher(dateKey)` → invalidates `entriesQueryKey(dateKey)`
- `useReminderDoneWatcher()` → invalidates `pendingReminderQueryKey(entryId)`

### Optimistic concurrency

Entries use a `version` field for optimistic concurrency control. On 409 Conflict, the query is refetched to get the latest version before retrying.

## Consequences

### Positive

- Clear separation: UI state (Zustand) vs server state (TanStack Query).
- Automatic caching and deduplication of identical requests.
- Built-in loading/error/stale state handling reduces boilerplate.
- Notification watchers provide reactive updates without WebSocket complexity.
- Query invalidation ensures consistency after mutations.

### Negative / Trade-offs

- Adds `@tanstack/react-query` dependency (~12KB gzipped).
- Query key management requires discipline to avoid stale caches.
- Watcher pattern uses polling (not push); slightly delayed updates compared to SSE/WebSocket.
- Developers must understand when to use Zustand vs TanStack Query (documented in AGENTS.md).

## Alternatives Considered

1. **Zustand for everything (UI + server state)**
   - Rejected: would duplicate caching, refetching, and invalidation logic that TanStack Query provides out of the box.
2. **SWR (Vercel)**
   - Considered: similar capabilities but TanStack Query offers richer mutation support, better devtools, and more granular cache control.
3. **RTK Query (Redux Toolkit)**
   - Rejected: would require adopting Redux, which contradicts the lightweight Zustand decision (ADR-002).
4. **Manual fetch + useState**
   - Rejected: excessive boilerplate for loading/error states, no caching, no automatic refetching.

## References

- `src/shared/api/queries/` — all query hooks
- `src/shared/api/sdk.ts` — type-safe API client
- `src/shared/store/index.ts` — Zustand store (UI-only)
- `src/features/dashboard/components/Dashboard.tsx` — watcher hook usage
