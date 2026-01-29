/**
 * Entry types for the Neuraal application
 * 
 * An Entry is the core content entity. It can be a task, note, or project.
 * All entries share the same base structure with type-specific behaviors.
 */

import type { 
  EntryId, 
  TopicId, 
  UserId, 
  ReminderId, 
  AttachmentId,
  ISODate, 
  ISODateTime, 
  EntityMeta 
} from "./base";

// Re-export EntryId for convenience
export type { EntryId } from "./base";

// ============================================================================
// Entry Type Discriminator
// ============================================================================

/**
 * Discriminator for entry types.
 * 
 * - task: Default type. Action items with completion status.
 * - note: Free-form text content without completion tracking.
 * - project: (Future) Container for related tasks/notes.
 */
export type EntryType = "task" | "note" | "project";

// ============================================================================
// Entry Status
// ============================================================================

/**
 * Lifecycle status of an entry.
 * 
 * - active: Default state, visible and editable
 * - done: Completed (for tasks)
 * - archived: Hidden from main view but preserved
 * - deleted: Soft deleted, pending permanent removal
 * 
 * Future extensions: 'in_progress', 'blocked', 'deferred'
 */
export type EntryStatus = "active" | "done" | "archived" | "deleted";

// ============================================================================
// Topic Assignment Mode
// ============================================================================

/**
 * How the topic was assigned to an entry.
 * 
 * - manual: User explicitly selected the topic
 * - auto: AI/system suggested and applied the topic
 */
export type TopicMode = "manual" | "auto";

/**
 * AI-generated topic suggestion (when topicMode is 'auto').
 */
export interface TopicSuggestion {
  /** Suggested topic ID */
  readonly topicId: TopicId;
  /** Confidence score (0.0 to 1.0) */
  readonly confidence: number;
  /** When the suggestion was generated */
  readonly suggestedAt: ISODateTime;
}

// ============================================================================
// Content Format
// ============================================================================

/**
 * Supported content formats for entry body.
 * 
 * - plain: Simple text with no formatting
 * - markdown: Markdown syntax
 * - html: Sanitized HTML
 * - rich-json: Structured JSON (for editors like TipTap, ProseMirror)
 */
export type ContentFormat = "plain" | "markdown" | "html" | "rich-json";

/**
 * Entry content with format information (discriminated union).
 * 
 * TypeScript will narrow the `value` type based on `format`:
 * - plain/markdown/html → value is string
 * - rich-json → value is unknown (editor-specific schema)
 */
export type Content =
  | { readonly format: "plain"; readonly value: string }
  | { readonly format: "markdown"; readonly value: string }
  | { readonly format: "html"; readonly value: string }
  | { readonly format: "rich-json"; readonly value: unknown };

// ============================================================================
// Attachments (Discriminated Union)
// ============================================================================

/**
 * How the attachment was added.
 */
export type AttachmentSource = "upload" | "pasted" | "link";

/**
 * Discriminator for attachment types.
 * Enables TypeScript narrowing on attachment union.
 */
export type AttachmentKind = "image" | "file" | "youtube" | "code";

/**
 * Base properties shared by ALL attachment types.
 * Every attachment must have these fields for consistent handling.
 */
interface AttachmentBase {
  readonly id: AttachmentId;
  readonly kind: AttachmentKind;
  readonly createdAt: ISODateTime;
  /** Size in bytes (0 for external links like YouTube) */
  readonly sizeBytes: number;
  /** How the attachment was added */
  readonly source: AttachmentSource;
}

/**
 * Image attachment (pasted or uploaded).
 */
export interface ImageAttachment extends AttachmentBase {
  readonly kind: "image";
  /** URL to the stored image */
  readonly url: string;
  /** MIME type (e.g., "image/png", "image/jpeg") */
  readonly mimeType: string;
  /** Original filename if available */
  readonly filename?: string;
  /** Image dimensions */
  readonly width?: number;
  readonly height?: number;
  /** Alt text for accessibility */
  readonly alt?: string;
}

/**
 * Generic file attachment (PDF, DOCX, ZIP, etc.).
 */
export interface FileAttachment extends AttachmentBase {
  readonly kind: "file";
  /** URL to the stored file */
  readonly url: string;
  /** MIME type */
  readonly mimeType: string;
  /** Original filename */
  readonly filename: string;
}

/**
 * Embedded YouTube video.
 */
export interface YouTubeAttachment extends AttachmentBase {
  readonly kind: "youtube";
  /** YouTube video ID (e.g., "dQw4w9WgXcQ") */
  readonly videoId: string;
  /** Full URL for reference */
  readonly url: string;
  /** Video title if fetched */
  readonly title?: string;
  /** Thumbnail URL */
  readonly thumbnailUrl?: string;
  /** Start time in seconds (for timestamps) */
  readonly startSeconds?: number;
}

/**
 * Code snippet with syntax highlighting.
 */
export interface CodeAttachment extends AttachmentBase {
  readonly kind: "code";
  /** Source code content */
  readonly code: string;
  /** Programming language for syntax highlighting */
  readonly language: string;
  /** Optional filename or label */
  readonly filename?: string;
}

/**
 * Union of all attachment types.
 * Use discriminated union on `kind` field for type narrowing.
 */
export type Attachment =
  | ImageAttachment
  | FileAttachment
  | YouTubeAttachment
  | CodeAttachment;

// NOTE: MAX_ATTACHMENTS_SIZE_BYTES moved to @/shared/constants/attachments.ts

// ============================================================================
// Entry Entity
// ============================================================================

/**
 * Core Entry entity.
 * 
 * Entries are the main content units in Neuraal. They can be tasks,
 * notes, or projects. All entries are assigned to a specific date
 * (no time component - that's for reminders).
 * 
 * Design decisions:
 * - `reminderIds` is an array of ReminderId. The full Reminder entities
 *   are fetched separately when needed. This keeps Entry lightweight while
 *   maintaining the relationship.
 * - `attachments` are fully embedded since they're tightly coupled to content.
 * - `order` provides stable sorting within a day (entries have no time).
 */
export interface Entry {
  readonly id: EntryId;
  /** Owner user ID */
  readonly userId: UserId;
  /** Date the entry belongs to (YYYY-MM-DD, no time) */
  readonly date: ISODate;
  /** Type discriminator */
  readonly entryType: EntryType;
  /** Entry title/heading */
  readonly title: string;
  /** Rich content body */
  readonly content: Content;
  /** Assigned topic (optional for quick capture) */
  readonly topicId?: TopicId;
  /** How the topic was assigned */
  readonly topicMode: TopicMode;
  /** AI topic suggestion (when topicMode is 'auto') */
  readonly topicSuggestion?: TopicSuggestion;
  /** Embedded attachments */
  readonly attachments: Attachment[];
  /** IDs of associated reminders (fetched separately) */
  readonly reminderIds: ReminderId[];
  /** Current lifecycle status */
  readonly status: EntryStatus;
  /** Sort order within the day (lower = higher priority) */
  readonly order: number;
  /** Whether this entry is pinned to top */
  readonly pinned?: boolean;
  /** Entity metadata */
  readonly meta: EntityMeta;
}

// ============================================================================
// Legacy Compatibility Types
// ============================================================================

/**
 * @deprecated Use Entry with entryType: 'task' instead.
 * Kept for backward compatibility during migration.
 */
export interface LegacyTask {
  readonly id: string;
  readonly userId: UserId;
  readonly title: string;
  readonly topicId: TopicId;
  readonly completed: boolean;
  readonly createdAt: number;
}

/**
 * @deprecated Use Entry with entryType: 'note' instead.
 * Kept for backward compatibility during migration.
 */
export interface LegacyNote {
  readonly id: string;
  readonly userId: UserId;
  readonly content: string;
  readonly createdAt: number;
}

/**
 * @deprecated Use Record<ISODate, Entry[]> instead.
 */
export type TasksByDay = Record<number, LegacyTask[]>;

/**
 * @deprecated Use Record<ISODate, Entry[]> instead.
 */
export type NotesByDate = Record<string, LegacyNote[]>;
