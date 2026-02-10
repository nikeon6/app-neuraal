import { Result, ok, err } from "../core/Result";

/**
 * Valid notification type values.
 */
type NotificationTypeValue =
  | "REMINDER_SENT"
  | "REMINDER_FAILED"
  | "REMINDER_CANCELED"
  | "SUMMARY_IN_PROGRESS"
  | "SUMMARY_DONE"
  | "SUMMARY_FAILED"
  | "TRANSCRIPTION_IN_PROGRESS"
  | "TRANSCRIPTION_DONE"
  | "TRANSCRIPTION_FAILED";

/**
 * NotificationType value object.
 * Represents the type of notification.
 */
export class NotificationType {
  private readonly value: NotificationTypeValue;

  // Reminder types
  static readonly REMINDER_SENT = "REMINDER_SENT" as const;
  static readonly REMINDER_FAILED = "REMINDER_FAILED" as const;
  static readonly REMINDER_CANCELED = "REMINDER_CANCELED" as const;

  // Summary types
  static readonly SUMMARY_IN_PROGRESS = "SUMMARY_IN_PROGRESS" as const;
  static readonly SUMMARY_DONE = "SUMMARY_DONE" as const;
  static readonly SUMMARY_FAILED = "SUMMARY_FAILED" as const;

  // Transcription types
  static readonly TRANSCRIPTION_IN_PROGRESS = "TRANSCRIPTION_IN_PROGRESS" as const;
  static readonly TRANSCRIPTION_DONE = "TRANSCRIPTION_DONE" as const;
  static readonly TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED" as const;

  private static readonly VALID_TYPES: NotificationTypeValue[] = [
    NotificationType.REMINDER_SENT,
    NotificationType.REMINDER_FAILED,
    NotificationType.REMINDER_CANCELED,
    NotificationType.SUMMARY_IN_PROGRESS,
    NotificationType.SUMMARY_DONE,
    NotificationType.SUMMARY_FAILED,
    NotificationType.TRANSCRIPTION_IN_PROGRESS,
    NotificationType.TRANSCRIPTION_DONE,
    NotificationType.TRANSCRIPTION_FAILED,
  ];

  private constructor(value: NotificationTypeValue) {
    this.value = value;
  }

  static create(value: string): Result<NotificationType, string> {
    if (!value || value.trim().length === 0) {
      return err("Type cannot be empty");
    }

    const normalized = value.trim().toUpperCase();

    if (!NotificationType.VALID_TYPES.includes(normalized as NotificationTypeValue)) {
      return err(`Invalid type. Allowed: ${NotificationType.VALID_TYPES.join(", ")}`);
    }

    return ok(new NotificationType(normalized as NotificationTypeValue));
  }

  // Reminder factory methods
  static reminderSent(): NotificationType {
    return new NotificationType(NotificationType.REMINDER_SENT);
  }

  static reminderFailed(): NotificationType {
    return new NotificationType(NotificationType.REMINDER_FAILED);
  }

  static reminderCanceled(): NotificationType {
    return new NotificationType(NotificationType.REMINDER_CANCELED);
  }

  // Summary factory methods
  static summaryInProgress(): NotificationType {
    return new NotificationType(NotificationType.SUMMARY_IN_PROGRESS);
  }

  static summaryDone(): NotificationType {
    return new NotificationType(NotificationType.SUMMARY_DONE);
  }

  static summaryFailed(): NotificationType {
    return new NotificationType(NotificationType.SUMMARY_FAILED);
  }

  // Reminder type checks
  isReminderSent(): boolean {
    return this.value === NotificationType.REMINDER_SENT;
  }

  isReminderFailed(): boolean {
    return this.value === NotificationType.REMINDER_FAILED;
  }

  isReminderCanceled(): boolean {
    return this.value === NotificationType.REMINDER_CANCELED;
  }

  // Summary type checks
  isSummaryInProgress(): boolean {
    return this.value === NotificationType.SUMMARY_IN_PROGRESS;
  }

  isSummaryDone(): boolean {
    return this.value === NotificationType.SUMMARY_DONE;
  }

  isSummaryFailed(): boolean {
    return this.value === NotificationType.SUMMARY_FAILED;
  }

  // Transcription factory methods
  static transcriptionInProgress(): NotificationType {
    return new NotificationType(NotificationType.TRANSCRIPTION_IN_PROGRESS);
  }

  static transcriptionDone(): NotificationType {
    return new NotificationType(NotificationType.TRANSCRIPTION_DONE);
  }

  static transcriptionFailed(): NotificationType {
    return new NotificationType(NotificationType.TRANSCRIPTION_FAILED);
  }

  // Transcription type checks
  isTranscriptionInProgress(): boolean {
    return this.value === NotificationType.TRANSCRIPTION_IN_PROGRESS;
  }

  isTranscriptionDone(): boolean {
    return this.value === NotificationType.TRANSCRIPTION_DONE;
  }

  isTranscriptionFailed(): boolean {
    return this.value === NotificationType.TRANSCRIPTION_FAILED;
  }

  toString(): string {
    return this.value;
  }

  equals(other: NotificationType): boolean {
    return this.value === other.value;
  }
}
