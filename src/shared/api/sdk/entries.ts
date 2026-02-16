/**
 * Entries SDK — typed functions for /api/entries endpoints.
 *
 * All functions use the centralized apiClient (apiFetch / helpers).
 * Types are derived from the OpenAPI spec, never hand-crafted.
 */

import { get, post, patch, del } from "../apiClient";
import type { ApiEntry, CreateEntryBody, UpdateEntryBody } from "./types";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/entries?date=YYYY-MM-DD
 * Returns all entries for the authenticated user on the given date.
 */
export async function listEntriesByDate(date: string): Promise<ApiEntry[]> {
  const data = await get<{ entries: ApiEntry[] }>(
    `/api/entries?date=${encodeURIComponent(date)}`,
  );
  return data.entries;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** POST /api/entries — creates a new entry. */
export async function createEntry(input: CreateEntryBody): Promise<ApiEntry> {
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
  input: UpdateEntryBody,
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
  id: string,
): Promise<{ requestId: string; notificationId: string; message: string }> {
  return await post<{
    requestId: string;
    notificationId: string;
    message: string;
  }>(`/api/entries/${id}/summarize`);
}

// ---------------------------------------------------------------------------
// Clear Summary
// ---------------------------------------------------------------------------

/**
 * DELETE /api/entries/{id}/summary — clears the AI-generated summary.
 */
export async function clearSummary(id: string): Promise<void> {
  await del(`/api/entries/${id}/summary`);
}

// ---------------------------------------------------------------------------
// Vision AI (OCR + Image Description)
// ---------------------------------------------------------------------------

/** Vision analysis mode: "scan" extracts text, "describe" describes the image. */
export type VisionMode = "scan" | "describe";

/**
 * POST /api/entries/{id}/ocr — analyzes an image attachment with Ollama Vision.
 * Synchronous call — waits for Ollama Vision to process (5-60s typically).
 *
 * @param mode - "scan" for OCR text extraction, "describe" for image description.
 */
export async function analyzeImage(
  entryId: string,
  attachmentId: string,
  mode: VisionMode = "scan",
): Promise<{ attachmentId: string; extractedText: string; mode: VisionMode }> {
  return await post<{
    attachmentId: string;
    extractedText: string;
    mode: VisionMode;
  }>(
    `/api/entries/${entryId}/ocr`,
    { attachmentId, mode },
    { timeoutMs: 120_000 }, // Vision can take 15-60s on CPU; generous timeout for cold starts
  );
}

// ---------------------------------------------------------------------------
// Transcribe YouTube Video (async)
// ---------------------------------------------------------------------------

/**
 * POST /api/entries/{id}/transcription — requests async YouTube transcription (202).
 * The transcription arrives via notification when ready, and is injected
 * into the YouTube node in the entry content.
 */
export async function requestTranscription(
  entryId: string,
  youtubeUrl: string,
): Promise<{ requestId: string; notificationId: string; message: string }> {
  return await post<{
    requestId: string;
    notificationId: string;
    message: string;
  }>(`/api/entries/${entryId}/transcription`, { youtubeUrl });
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
  orderedIds: string[],
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
  threshold?: number,
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
