/**
 * UI types for the Calendar feature
 * 
 * These are presentation/view state types specific to the calendar
 * sidebar and day selection. Not domain types.
 */

import type { ISODate, TopicId } from "@/shared/types";
import type { CalendarDay, CalendarRange, TopicBubbleData } from "@/shared/types";

// ============================================================================
// Calendar View State
// ============================================================================

/**
 * Current state of the calendar view.
 * Used for coordinating between calendar sidebar and dashboard.
 */
export interface CalendarViewState {
  /** Currently displayed range */
  readonly visibleRange: CalendarRange;
  /** Selected date (if any) */
  readonly selectedDate?: ISODate;
  /** Selected day number (1-31) for quick access */
  readonly selectedDay?: number;
}

// ============================================================================
// Calendar Day UI
// ============================================================================

/**
 * Calendar day with computed UI properties.
 * Extends domain CalendarDay with presentation concerns.
 */
export interface CalendarDayUI extends CalendarDay {
  /** Day of month (1-31) - derived from date */
  readonly dayOfMonth: number;
  /** Weekday name (e.g., "Monday") - derived from date */
  readonly weekday: string;
  /** Short weekday (e.g., "Mon") - derived from date */
  readonly weekdayShort: string;
  /** Whether this is the currently selected day */
  readonly isSelected: boolean;
  /** Whether this is today */
  readonly isToday: boolean;
  /** Whether this day has any entries */
  readonly hasEntries: boolean;
}

// ============================================================================
// Calendar Month UI
// ============================================================================

/**
 * Calendar month data for the sidebar.
 */
export interface CalendarMonthUI {
  /** Year (e.g., 2024) */
  readonly year: number;
  /** Month (1-12) */
  readonly month: number;
  /** Display name (e.g., "January 2024") */
  readonly label: string;
  /** All days in the month with UI state */
  readonly days: CalendarDayUI[];
}

// ============================================================================
// Topic Bubble UI
// ============================================================================

/**
 * Topic bubble with UI state for the calendar view.
 */
export interface TopicBubbleUI extends TopicBubbleData {
  /** Whether this topic is currently highlighted */
  readonly isHighlighted: boolean;
}

// ============================================================================
// Helper: Create CalendarDayUI from CalendarDay
// ============================================================================

/**
 * Creates a CalendarDayUI from a CalendarDay and current selection.
 * This is a type definition - implementation should be in a utility file.
 */
export type CreateCalendarDayUI = (
  day: CalendarDay,
  selectedDate: ISODate | undefined,
  today: ISODate
) => CalendarDayUI;
