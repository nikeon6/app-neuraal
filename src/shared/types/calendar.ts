/**
 * Calendar types for the Neuraal application
 * 
 * Types for calendar data and entry summaries.
 * These are domain types used for data transfer.
 * 
 * NOTE: UI-specific types (CalendarViewState, visual state)
 * should go in src/features/calendar/types.ts
 */

import type { EntryId, TopicId, ISODate } from "./base";
import type { EntryType, EntryStatus } from "./entry";

// ============================================================================
// Calendar Range
// ============================================================================

/**
 * Date range for calendar queries.
 * Both dates are inclusive.
 */
export interface CalendarRange {
  /** Start date (inclusive) */
  readonly start: ISODate;
  /** End date (inclusive) */
  readonly end: ISODate;
}

// ============================================================================
// Entry Summary (for calendar views)
// ============================================================================

/**
 * Lightweight summary of an entry for calendar display.
 * 
 * Used in day lists and calendar overviews where full entry
 * data is not needed.
 */
export interface EntrySummary {
  readonly id: EntryId;
  readonly title: string;
  readonly date: ISODate;
  readonly entryType: EntryType;
  readonly status: EntryStatus;
  readonly topicId?: TopicId;
  /** Sort order within the day */
  readonly order: number;
  /** Whether this entry is pinned to top */
  readonly pinned?: boolean;
  /** Whether entry has reminders */
  readonly hasReminders: boolean;
  /** Whether entry has attachments */
  readonly hasAttachments: boolean;
}

// ============================================================================
// Calendar Day
// ============================================================================

/**
 * A single day in the calendar with its entries.
 * 
 * NOTE: dayOfMonth, weekday, isToday, isSelected are derivable
 * from `date` and should be computed in UI/mappers, not stored.
 */
export interface CalendarDay {
  /** Date in ISO format (YYYY-MM-DD) */
  readonly date: ISODate;
  /** Entries for this day (summarized) */
  readonly entries: EntrySummary[];
}

// ============================================================================
// Topic Bubble (Domain data, not UI position)
// ============================================================================

/**
 * Aggregated topic data for bubble display.
 * This is the DATA for a bubble, not its visual position.
 * 
 * NOTE: Visual position/state should be in features/topics/types.ts
 */
export interface TopicBubbleData {
  readonly topicId: TopicId;
  /** Display label */
  readonly label: string;
  /** Number of entries with this topic in current view */
  readonly count: number;
  /** Topic color for the bubble */
  readonly color: string;
}

/**
 * Aggregated stats for a topic in a date range.
 */
export interface TopicStats {
  readonly topicId: TopicId;
  readonly totalEntries: number;
  readonly completedEntries: number;
  readonly activeEntries: number;
}
