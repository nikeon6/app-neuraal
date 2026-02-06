/**
 * SDK barrel — re-exports all typed API functions and types.
 *
 * @example
 * import { listTopics, createEntry, type ApiTopic } from "@/shared/api/sdk";
 *
 * ## Manual QA Checklist (UI ↔ Backend Integration)
 *
 * Prerequisites:
 *   - Backend running: `pnpm dev` (or docker compose up)
 *   - Database seeded with at least one user (x-user-id = "user-123" in dev)
 *   - Postgres + pgvector extension enabled
 *
 * 1. **Topics**
 *    - [ ] Create a topic from the Topics section → appears in the list immediately
 *    - [ ] Refresh page → topic persists (loaded from API)
 *    - [ ] Delete a topic → disappears from list; entries with that topic keep working
 *    - [ ] Topic bubbles (FloatingTopics) reflect API topics dynamically
 *
 * 2. **Entries (Tasks/Notes)**
 *    - [ ] Create an entry via "Add task" button → appears in TasksContainer
 *    - [ ] Refresh page → entry persists (loaded from API for current date)
 *    - [ ] Change selected day in calendar → entries load for the new date
 *    - [ ] Edit entry title in TaskEditor → auto-saves after 1s debounce
 *    - [ ] Change topic of an entry → saves via API (check "Saving..." indicator)
 *    - [ ] Toggle task completed → persists on refresh
 *    - [ ] Delete an entry → disappears from list
 *
 * 3. **Calendar**
 *    - [ ] Dot indicators on days reflect actual entries from API
 *    - [ ] Expanding a day shows entry pills with correct topic colors
 *    - [ ] Mobile horizontal calendar shows dots for days with entries
 *
 * 4. **Error scenarios**
 *    - [ ] Stop backend → UI shows console errors, doesn't crash
 *    - [ ] Create entry with backend stopped → error logged, UI recovers
 *    - [ ] 409 conflict (stale version) → entries reload for that date
 */

// Types
export type {
  ApiTopic,
  ApiEntry,
  ApiReminder,
  ApiNotification,
  ApiAttachment,
  ApiErrorResponse,
  CreateTopicBody,
  UpdateTopicBody,
  CreateEntryBody,
  UpdateEntryBody,
  AutoTopicBody,
} from "./types";

// Topics
export {
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  rebuildTopicEmbedding,
} from "./topics";

// Entries
export {
  listEntriesByDate,
  createEntry,
  updateEntry,
  deleteEntry,
  summarizeEntry,
  autoTopicEntry,
} from "./entries";
