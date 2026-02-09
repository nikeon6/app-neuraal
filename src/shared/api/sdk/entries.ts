/**
 * Entries SDK — typed functions for /api/entries endpoints.
 *
 * All functions use the centralized apiClient (apiFetch / helpers).
 * Types are derived from the OpenAPI spec, never hand-crafted.
 */

import { get, post, patch, del } from "../apiClient";
import type {
  ApiEntry,
  CreateEntryBody,
  UpdateEntryBody,
} from "./types";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/entries?date=YYYY-MM-DD
 * Returns all entries for the authenticated user on the given date.
 */
export async function listEntriesByDate(date: string): Promise<ApiEntry[]> {
  const data = await get<{ entries: ApiEntry[] }>(
    `/api/entries?date=${encodeURIComponent(date)}`
  );
  return data.entries;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** POST /api/entries — creates a new entry. */
export async function createEntry(
  input: CreateEntryBody
): Promise<ApiEntry> {
  const data = await post<{ entry: ApiEntry }>("/api/entries", input);
  return data.entry;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * PATCH /api/entries/{id} — updates an existing entry.
 * Supports optimistic concurrency via the `version` field.
 */
export async function updateEntry(
  id: string,
  input: UpdateEntryBody
): Promise<ApiEntry> {
  const data = await patch<{ entry: ApiEntry }>(`/api/entries/${id}`, input);
  return data.entry;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** DELETE /api/entries/{id} — deletes an entry. */
export async function deleteEntry(id: string): Promise<void> {
  await del(`/api/entries/${id}`);
}

// ---------------------------------------------------------------------------
// Summarize (async)
// ---------------------------------------------------------------------------

/**
 * POST /api/entries/{id}/summarize — requests async AI summary (202 Accepted).
 * The summary arrives via notification when ready.
 */
export async function summarizeEntry(
  id: string
): Promise<{ requestId: string; notificationId: string; message: string }> {
  return await post<{
    requestId: string;
    notificationId: string;
    message: string;
  }>(`/api/entries/${id}/summarize`);
}

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

/**
 * PATCH /api/entries/reorder — bulk-updates display order for a given date.
 * Returns 204 No Content on success.
 */
export async function reorderEntries(
  date: string,
  orderedIds: string[]
): Promise<void> {
  await patch("/api/entries/reorder", { date, orderedIds });
}

// ---------------------------------------------------------------------------
// Auto-topic
// ---------------------------------------------------------------------------

/**
 * POST /api/entries/{id}/auto-topic — auto-assigns the best matching topic.
 * Returns null selectedTopicId if no match above threshold.
 */
export async function autoTopicEntry(
  id: string,
  threshold?: number
): Promise<{
  entryId: string;
  selectedTopicId: string | null;
  score: number | null;
}> {
  const body = threshold !== undefined ? { threshold } : undefined;
  return await post<{
    entryId: string;
    selectedTopicId: string | null;
    score: number | null;
  }>(`/api/entries/${id}/auto-topic`, body);
}
