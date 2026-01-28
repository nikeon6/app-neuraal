/**
 * Topic types for the Neuraal application
 * 
 * Topics are categories that group entries (tasks, notes, projects).
 * Each user can have custom topics with visual properties.
 * 
 * NOTE: UI-specific types (TopicPosition, TopicAnchor for bubbles)
 * are in src/features/topics/types.ts
 */

import type { TopicId, UserId, EntityMeta } from "./base";

// Re-export TopicId for convenience
export type { TopicId } from "./base";

// ============================================================================
// Topic Entity (Discriminated Union)
// ============================================================================

/**
 * Base properties shared by all topic types.
 */
interface TopicBase {
  readonly id: TopicId;
  /** Display name (localized) */
  readonly name: string;
  /** Hex color for visual representation (e.g., "#e11d48") */
  readonly color: string;
  /** Optional icon identifier (for future use) */
  readonly icon?: string;
  /** Whether the topic is archived (hidden from selection) */
  readonly isArchived?: boolean;
}

/**
 * User-created topic.
 * Always has a userId, never isSystem: true.
 */
export interface UserTopic extends TopicBase {
  readonly isSystem?: false;
  /** Owner user ID (required for user topics) */
  readonly userId: UserId;
  /** Entity metadata */
  readonly meta: EntityMeta;
}

/**
 * System-provided default topic.
 * No userId, always isSystem: true.
 */
export interface SystemTopic extends TopicBase {
  readonly isSystem: true;
  /** System topics don't have an owner */
  readonly userId?: never;
  /** System topics don't have metadata (they're constants) */
  readonly meta?: never;
}

/**
 * Topic entity (discriminated union).
 * 
 * Use `topic.isSystem` to narrow the type:
 * - `topic.isSystem === true` → SystemTopic
 * - `!topic.isSystem` → UserTopic
 */
export type Topic = UserTopic | SystemTopic;

/**
 * Lightweight topic reference for lists and selections.
 * Used when full topic data is not needed.
 */
export interface TopicRef {
  readonly id: TopicId;
  readonly name: string;
  readonly color: string;
}
