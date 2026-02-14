/**
 * Topics SDK — typed functions for /api/topics endpoints.
 *
 * All functions use the centralized apiClient (apiFetch / helpers).
 * Types are derived from the OpenAPI spec, never hand-crafted.
 */

import { get, post, patch, del } from "../apiClient";
import type { ApiTopic, CreateTopicBody, UpdateTopicBody } from "./types";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/** GET /api/topics — returns all topics for the authenticated user. */
export async function listTopics(): Promise<ApiTopic[]> {
  const data = await get<{ topics: ApiTopic[] }>("/api/topics");
  return data.topics;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** POST /api/topics — creates a new topic. */
export async function createTopic(input: CreateTopicBody): Promise<ApiTopic> {
  const data = await post<{ topic: ApiTopic }>("/api/topics", input);
  return data.topic;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** PATCH /api/topics/{id} — updates an existing topic. */
export async function updateTopic(
  id: string,
  input: UpdateTopicBody,
): Promise<ApiTopic> {
  const data = await patch<{ topic: ApiTopic }>(`/api/topics/${id}`, input);
  return data.topic;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** DELETE /api/topics/{id} — deletes a topic. */
export async function deleteTopic(id: string): Promise<void> {
  await del(`/api/topics/${id}`);
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

/** POST /api/topics/{id}/embedding/rebuild — recalculates topic embedding. */
export async function rebuildTopicEmbedding(
  id: string,
): Promise<{ topicId: string; embeddingUpdatedAt: string }> {
  return await post<{ topicId: string; embeddingUpdatedAt: string }>(
    `/api/topics/${id}/embedding/rebuild`,
  );
}
