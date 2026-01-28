/**
 * Reminder types for the Neuraal application
 * 
 * Reminders are scheduled notifications linked to entries.
 * Unlike entries (date only), reminders have specific times and timezones.
 */

import type { ReminderId, EntryId, UserId, ISODateTime, Timezone, EntityMeta } from "./base";

// Re-export ReminderId for convenience
export type { ReminderId } from "./base";

// ============================================================================
// Reminder Status
// ============================================================================

/**
 * Lifecycle status of a reminder.
 * 
 * - scheduled: Waiting to be sent at scheduledFor time
 * - sent: Successfully delivered
 * - snoozed: Temporarily delayed by user
 * - cancelled: User cancelled before sending
 * - failed: Delivery failed (will be retried or marked permanent)
 */
export type ReminderStatus = "scheduled" | "sent" | "snoozed" | "cancelled" | "failed";

// ============================================================================
// Reminder Channel
// ============================================================================

/**
 * Delivery channel for the reminder.
 * 
 * - in_app: Notification within the app
 * - email: Email notification
 * - push: Push notification to mobile/desktop
 * 
 * Future extensions: 'sms', 'webhook'
 */
export type ReminderChannel = "in_app" | "email" | "push";

// ============================================================================
// Reminder Entity
// ============================================================================

/**
 * Recurrence rule for repeating reminders.
 * Uses iCalendar RRULE format for flexibility.
 * 
 * @example "FREQ=DAILY;INTERVAL=1" - every day
 * @example "FREQ=WEEKLY;BYDAY=MO,WE,FR" - Mon/Wed/Fri
 */
export interface RecurrenceRule {
  /** iCalendar RRULE string */
  readonly rule: string;
  /** End date for recurrence (optional) */
  readonly until?: ISODateTime;
  /** Maximum occurrences (optional) */
  readonly count?: number;
}

/**
 * Reminder entity for scheduled notifications.
 * 
 * Reminders are always linked to an Entry and have a specific
 * datetime with timezone for accurate scheduling across time zones.
 */
export interface Reminder {
  readonly id: ReminderId;
  /** The entry this reminder is for */
  readonly entryId: EntryId;
  /** Owner user ID */
  readonly userId: UserId;
  /** When to send the reminder (ISO datetime with offset) */
  readonly scheduledFor: ISODateTime;
  /** User's timezone for display and relative calculations */
  readonly timezone: Timezone;
  /** Current status */
  readonly status: ReminderStatus;
  /** Delivery channel (defaults to 'in_app') */
  readonly channel: ReminderChannel;
  /** Optional custom message (overrides entry title) */
  readonly message?: string;
  /** When the reminder was actually sent (if status is 'sent') */
  readonly sentAt?: ISODateTime;
  /** When the reminder was last triggered (for recurring) */
  readonly lastTriggeredAt?: ISODateTime;
  /** Snoozed until this time (if status is 'snoozed') */
  readonly snoozedUntil?: ISODateTime;
  /** Recurrence rule for repeating reminders (optional) */
  readonly recurrence?: RecurrenceRule;
  /** Error message if status is 'failed' */
  readonly errorMessage?: string;
  /** Entity metadata */
  readonly meta: EntityMeta;
}
