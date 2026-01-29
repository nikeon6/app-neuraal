/**
 * UI types for the Task Editor feature
 * 
 * These are local types specific to the task editor component.
 * Domain types come from @/shared/types.
 */

import type {
  EntryId,
  TopicId,
  DefaultTopicId,
  ISODate,
  EntryType,
  TopicMode,
  ContentFormat,
  AttachmentKind,
} from "@/shared/types";

// ============================================================================
// Entry Draft (Editor local state)
// ============================================================================

/**
 * Draft state for an entry being edited.
 * This is UI state, not the persisted Entry type.
 * 
 * Uses simplified types suitable for form state.
 */
export interface EntryDraft {
  /** Entry ID (undefined for new entries) */
  id?: EntryId;
  /** Entry title */
  title: string;
  /** Plain text content (simplified for now, will support rich content later) */
  content: string;
  /** Content format */
  contentFormat: ContentFormat;
  /** Selected topic ID or "auto" for AI suggestion */
  topicId: DefaultTopicId | "auto";
  /** How topic was assigned */
  topicMode: TopicMode;
  /** Entry type (defaults to "task") */
  entryType: EntryType;
  /** Target date for the entry */
  date: ISODate;
  /** Draft attachments pending upload */
  attachments: DraftAttachment[];
  /** Whether the draft has unsaved changes */
  isDirty: boolean;
}

/**
 * Attachment in draft state (pending upload or already uploaded).
 */
export interface DraftAttachment {
  /** Local ID for tracking (not the server ID yet) */
  localId: string;
  /** Attachment type */
  kind: AttachmentKind;
  /** File name */
  filename: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Preview URL (for images) or content (for code) */
  preview?: string;
  /** Upload status */
  status: "pending" | "uploading" | "uploaded" | "error";
  /** Server ID once uploaded */
  serverId?: string;
  /** Error message if status is "error" */
  error?: string;
}

/**
 * Default values for a new entry draft.
 */
export function createEmptyDraft(date: ISODate): EntryDraft {
  return {
    id: undefined,
    title: "",
    content: "",
    contentFormat: "plain",
    topicId: "auto",
    topicMode: "auto",
    entryType: "task",
    date,
    attachments: [],
    isDirty: false,
  };
}

// ============================================================================
// Editor UI State
// ============================================================================

/**
 * UI state for the task editor component.
 * Separated from draft content for clarity.
 */
export interface TaskEditorUIState {
  /** Whether editor is expanded */
  isExpanded: boolean;
  /** Whether content menu is open */
  isContentMenuOpen: boolean;
  /** Whether topic menu is open */
  isTopicMenuOpen: boolean;
  /** Whether currently saving */
  isSaving: boolean;
  /** Last save error (if any) */
  saveError?: string;
}

/**
 * Content menu item configuration.
 */
export interface ContentMenuItem {
  id: AttachmentKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}
