/**
 * Domain types for the Neuraal application
 * 
 * This is the main entry point for all shared types.
 * Import from "@/shared/types" to access any type.
 * 
 * NOTE: UI-specific types are in their respective features:
 * - src/features/topics/types.ts (TopicPosition, TopicAnchor, etc.)
 * - src/features/calendar/types.ts (CalendarViewState, CalendarDayUI, etc.)
 * 
 * @example
 * import type { Entry, Topic, CalendarDay, CreateEntryInput } from "@/shared/types";
 */

// ============================================================================
// Base Types
// ============================================================================
export type {
  ID,
  EntryId,
  TopicId,
  DefaultTopicId,
  ReminderId,
  AttachmentId,
  UserId,
  ISODate,
  ISODateTime,
  Timezone,
  EntityMeta,
  RequireKeys,
  PartialExcept,
  EntityID,
} from "./base";

// ============================================================================
// Topic Types
// ============================================================================
export type {
  UserTopic,
  SystemTopic,
  Topic,
  TopicRef,
} from "./topic";

// ============================================================================
// Entry Types
// ============================================================================
export type {
  EntryType,
  EntryStatus,
  TopicMode,
  TopicSuggestion,
  ContentFormat,
  Content,
  AttachmentSource,
  AttachmentKind,
  ImageAttachment,
  FileAttachment,
  YouTubeAttachment,
  CodeAttachment,
  Attachment,
  Entry,
  // Legacy compatibility
  LegacyTask,
  LegacyNote,
  TasksByDay,
  NotesByDate,
} from "./entry";

// NOTE: MAX_ATTACHMENTS_SIZE_BYTES moved to @/shared/constants

// ============================================================================
// Reminder Types
// ============================================================================
export type {
  ReminderStatus,
  ReminderChannel,
  RecurrenceRule,
  Reminder,
} from "./reminder";

// ============================================================================
// Calendar Types (Domain only, not UI)
// ============================================================================
export type {
  CalendarRange,
  EntrySummary,
  CalendarDay,
  TopicBubbleData,
  TopicStats,
} from "./calendar";

// ============================================================================
// DTO Types
// ============================================================================
export type {
  CreateEntryInput,
  EntryPatch,
  UpdateEntryInput,
  AddAttachmentInput,
  RemoveAttachmentInput,
  CreateTopicInput,
  TopicPatch,
  UpdateTopicInput,
  CreateReminderInput,
  ReminderPatch,
  UpdateReminderInput,
  GetEntriesQuery,
  GetRemindersQuery,
} from "./dto";

// ============================================================================
// Legacy Compatibility Aliases
// ============================================================================
// These aliases maintain backward compatibility with existing store and components.
// They will be removed once the migration to Entry type is complete.

/**
 * @deprecated Use Entry with entryType: "task" instead.
 * Kept for backward compatibility with the current store.
 */
export type Task = import("./entry").LegacyTask;

/**
 * @deprecated Use Entry with entryType: "note" instead.
 * Kept for backward compatibility with the current store.
 */
export type Note = import("./entry").LegacyNote;

// NOTE: UI types like TopicPosition, JunctionPosition are in their respective
// feature directories:
// - src/features/topics/types.ts
// - src/features/calendar/types.ts
