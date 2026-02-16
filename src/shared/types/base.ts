/**
 * Base types for the Neuraal application
 *
 * These are foundational types used across all domain entities.
 * Keep this file free of business logic - only type definitions.
 */

// ============================================================================
// Branded ID Types (for type safety)
// ============================================================================

/**
 * Base unique identifier type.
 * Format: UUID v4 or nanoid-style string.
 */
export type ID = string;

/**
 * Specific ID types for each entity.
 * These are aliases now, but can be converted to branded types
 * for stricter type checking if needed.
 *
 * @example Converting to branded types:
 * type EntryId = string & { readonly __brand: 'EntryId' };
 */
export type EntryId = ID;
export type TopicId = ID;
export type ReminderId = ID;
export type AttachmentId = ID;
export type UserId = ID;

/**
 * Default topic IDs (built-in system topics).
 * These are the predefined topics available to all users.
 *
 * User-created topics use TopicId (UUID format).
 */
export type DefaultTopicId =
  | "work"
  | "health"
  | "fun"
  | "family"
  | "learning"
  | "social";

// ============================================================================
// Date/Time Types
// ============================================================================

/**
 * ISO 8601 date string without time component.
 * Format: "YYYY-MM-DD" (e.g., "2024-01-15")
 *
 * Used for: Entry dates, calendar days.
 * Entries only have a date, no time.
 */
export type ISODate = string;

/**
 * ISO 8601 datetime string with timezone offset.
 * Format: "YYYY-MM-DDTHH:mm:ss.sssZ" or "YYYY-MM-DDTHH:mm:ss±HH:mm"
 *
 * Used for: Reminders, timestamps in metadata.
 */
export type ISODateTime = string;

/**
 * IANA timezone identifier.
 * Examples: "America/New_York", "Europe/Madrid", "UTC"
 *
 * Used alongside ISODateTime for reminder scheduling.
 */
export type Timezone = string;

// ============================================================================
// Entity Metadata
// ============================================================================

/**
 * Common metadata fields for all persisted entities.
 *
 * - createdAt: When the entity was first created
 * - updatedAt: When the entity was last modified
 * - deletedAt: Soft delete timestamp (undefined = not deleted)
 * - version: Optimistic concurrency control (for autosave conflict detection)
 */
export interface EntityMeta {
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly deletedAt?: ISODateTime;
  /**
   * Version number for optimistic locking.
   * Incremented on each update. Used to detect conflicts in autosave.
   * Backend rejects updates if version doesn't match.
   */
  readonly version: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes specified keys required in a type.
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes all properties optional except specified keys.
 */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> &
  Pick<T, K>;

/**
 * Extracts the ID type from an entity.
 */
export type EntityID<T extends { id: ID }> = T["id"];
