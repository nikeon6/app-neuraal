/**
 * Data Transfer Objects (DTOs) for the Neuraal application
 *
 * DTOs define the shape of data for API requests.
 * They exclude auto-generated fields like id, meta, etc.
 *
 * IMPORTANT: These DTOs explicitly define allowed fields to prevent
 * accidental updates to protected fields (like meta, userId, etc.)
 */

import type {
  EntryId,
  TopicId,
  ReminderId,
  AttachmentId,
  ISODate,
  ISODateTime,
  Timezone,
} from "./base";
import type {
  EntryType,
  EntryStatus,
  TopicMode,
  Content,
  Attachment,
} from "./entry";
import type {
  ReminderStatus,
  ReminderChannel,
  RecurrenceRule,
} from "./reminder";

// ============================================================================
// Entry DTOs
// ============================================================================

/**
 * Input for creating a new entry.
 *
 * Required: date, title
 * Optional: everything else (sensible defaults applied)
 */
export interface CreateEntryInput {
  /** Date the entry belongs to */
  readonly date: ISODate;
  /** Entry title */
  readonly title: string;
  /** Entry type (defaults to 'task') */
  readonly entryType?: EntryType;
  /** Content body */
  readonly content?: Content;
  /** Assigned topic */
  readonly topicId?: TopicId;
  /** Topic assignment mode (defaults to 'manual' if topicId provided) */
  readonly topicMode?: TopicMode;
  /** Initial status (defaults to 'active') */
  readonly status?: EntryStatus;
  /** Sort order within day (auto-assigned if not provided) */
  readonly order?: number;
  /** Whether pinned to top */
  readonly pinned?: boolean;
}

/**
 * Allowed fields for updating an entry.
 *
 * Explicitly excludes: id, userId, entryType, meta, attachments, reminderIds
 * - Use AddAttachmentInput/RemoveAttachmentInput for attachments
 * - Use CreateReminderInput for reminders
 */
export interface EntryPatch {
  /** Move entry to different day */
  readonly date?: ISODate;
  /** Update title */
  readonly title?: string;
  /** Update content */
  readonly content?: Content;
  /** Change assigned topic (null to remove) */
  readonly topicId?: TopicId | null;
  /** Change topic mode */
  readonly topicMode?: TopicMode;
  /** Change status */
  readonly status?: EntryStatus;
  /** Change sort order */
  readonly order?: number;
  /** Change pinned state */
  readonly pinned?: boolean;
}

/**
 * Input for updating an existing entry.
 *
 * Uses explicit patch object to prevent accidental meta/userId updates.
 * Includes version for optimistic concurrency control.
 */
export interface UpdateEntryInput {
  /** Entry ID to update */
  readonly id: EntryId;
  /** Current version (for conflict detection) */
  readonly version: number;
  /** Fields to update */
  readonly patch: EntryPatch;
}

/**
 * Input for adding an attachment to an entry.
 */
export interface AddAttachmentInput {
  /** Entry to attach to */
  readonly entryId: EntryId;
  /** Attachment data (without id and createdAt) */
  readonly attachment: Omit<Attachment, "id" | "createdAt">;
}

/**
 * Input for removing an attachment from an entry.
 */
export interface RemoveAttachmentInput {
  readonly entryId: EntryId;
  readonly attachmentId: AttachmentId;
}

// ============================================================================
// Topic DTOs
// ============================================================================

/**
 * Input for creating a new custom topic.
 */
export interface CreateTopicInput {
  /** Topic display name */
  readonly name: string;
  /** Hex color (e.g., "#e11d48") */
  readonly color: string;
  /** Optional icon identifier */
  readonly icon?: string;
}

/**
 * Allowed fields for updating a topic.
 */
export interface TopicPatch {
  /** Updated name */
  readonly name?: string;
  /** Updated color */
  readonly color?: string;
  /** Updated icon (null to remove) */
  readonly icon?: string | null;
  /** Archive/unarchive the topic */
  readonly isArchived?: boolean;
}

/**
 * Input for updating an existing topic.
 */
export interface UpdateTopicInput {
  /** Topic ID to update */
  readonly id: TopicId;
  /** Current version (for conflict detection) */
  readonly version: number;
  /** Fields to update */
  readonly patch: TopicPatch;
}

// ============================================================================
// Reminder DTOs
// ============================================================================

/**
 * Input for creating a new reminder.
 */
export interface CreateReminderInput {
  /** Entry to create reminder for */
  readonly entryId: EntryId;
  /** When to send the reminder */
  readonly scheduledFor: ISODateTime;
  /** User's timezone */
  readonly timezone: Timezone;
  /** Delivery channel (defaults to 'in_app') */
  readonly channel?: ReminderChannel;
  /** Optional custom message */
  readonly message?: string;
  /** Recurrence rule (optional) */
  readonly recurrence?: RecurrenceRule;
}

/**
 * Allowed fields for updating a reminder.
 */
export interface ReminderPatch {
  /** Reschedule the reminder */
  readonly scheduledFor?: ISODateTime;
  /** Change timezone */
  readonly timezone?: Timezone;
  /** Change delivery channel */
  readonly channel?: ReminderChannel;
  /** Update custom message (null to remove) */
  readonly message?: string | null;
  /** Change status (e.g., cancel, snooze) */
  readonly status?: ReminderStatus;
  /** Snooze until this time */
  readonly snoozedUntil?: ISODateTime;
  /** Update recurrence (null to remove) */
  readonly recurrence?: RecurrenceRule | null;
}

/**
 * Input for updating an existing reminder.
 */
export interface UpdateReminderInput {
  /** Reminder ID to update */
  readonly id: ReminderId;
  /** Current version (for conflict detection) */
  readonly version: number;
  /** Fields to update */
  readonly patch: ReminderPatch;
}

// ============================================================================
// Query DTOs
// ============================================================================

/**
 * Query parameters for fetching entries.
 */
export interface GetEntriesQuery {
  /** Filter by date range (start) */
  readonly startDate?: ISODate;
  /** Filter by date range (end) */
  readonly endDate?: ISODate;
  /** Filter by entry type */
  readonly entryType?: EntryType;
  /** Filter by topic */
  readonly topicId?: TopicId;
  /** Filter by status */
  readonly status?: EntryStatus;
  /** Include archived entries */
  readonly includeArchived?: boolean;
  /** Pagination: max results */
  readonly limit?: number;
  /** Pagination: offset */
  readonly offset?: number;
}

/**
 * Query parameters for fetching reminders.
 */
export interface GetRemindersQuery {
  /** Filter by entry */
  readonly entryId?: EntryId;
  /** Filter by status */
  readonly status?: ReminderStatus;
  /** Filter by scheduled time range (start) */
  readonly scheduledAfter?: ISODateTime;
  /** Filter by scheduled time range (end) */
  readonly scheduledBefore?: ISODateTime;
  /** Pagination: max results */
  readonly limit?: number;
  /** Pagination: offset */
  readonly offset?: number;
}
