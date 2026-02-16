/**
 * Topic utility functions
 *
 * Helper functions for working with topics.
 * Separates data (constants) from logic (lib).
 */

import type { DefaultTopicId } from "@/shared/types";
import type { DefaultTopicConfig } from "@/features/topics/types";
import { TOPICS } from "@/shared/constants";

/**
 * Check if a topic ID is a default (built-in system) topic.
 *
 * @example
 * if (isDefaultTopicId(task.topicId)) {
 *   const topic = TOPICS[task.topicId]; // TypeScript knows it's valid
 * }
 */
export function isDefaultTopicId(id: string): id is DefaultTopicId {
  return id in TOPICS;
}

/**
 * Get a default topic config by ID.
 * Returns undefined if the ID is not a default topic.
 *
 * Use this for safe lookups when topicId might be user-created.
 *
 * @example
 * const topic = getDefaultTopic(entry.topicId);
 * const color = topic?.color ?? "#6b7280";
 */
export function getDefaultTopic(id: string): DefaultTopicConfig | undefined {
  return isDefaultTopicId(id) ? TOPICS[id] : undefined;
}

/**
 * Get the color for a topic ID, with fallback.
 *
 * @example
 * const color = getTopicColor(entry.topicId); // "#e11d48" or "#6b7280"
 */
export function getTopicColor(id: string, fallback = "#6b7280"): string {
  return getDefaultTopic(id)?.color ?? fallback;
}

/**
 * Get the name for a topic ID, with fallback.
 *
 * @example
 * const name = getTopicName(entry.topicId); // "Trabajo" or "Unknown"
 */
export function getTopicName(id: string, fallback = "Unknown"): string {
  return getDefaultTopic(id)?.name ?? fallback;
}
