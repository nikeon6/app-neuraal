import { Result, ok, err } from "../core/Result";

/**
 * ReminderStatus value object.
 * Represents the status of a reminder.
 */
export class ReminderStatus {
  private readonly value: "pending" | "sent" | "canceled" | "failed";

  static readonly PENDING = "pending" as const;
  static readonly SENT = "sent" as const;
  static readonly CANCELED = "canceled" as const;
  static readonly FAILED = "failed" as const;

  private static readonly VALID_STATUSES = [
    ReminderStatus.PENDING,
    ReminderStatus.SENT,
    ReminderStatus.CANCELED,
    ReminderStatus.FAILED,
  ] as const;

  private constructor(value: "pending" | "sent" | "canceled" | "failed") {
    this.value = value;
  }

  static create(value: string): Result<ReminderStatus, string> {
    if (!value || value.trim().length === 0) {
      return err("Status cannot be empty");
    }

    const normalized = value.trim().toLowerCase();

    if (!ReminderStatus.VALID_STATUSES.includes(normalized as typeof ReminderStatus.VALID_STATUSES[number])) {
      return err(`Invalid status. Allowed: ${ReminderStatus.VALID_STATUSES.join(", ")}`);
    }

    return ok(new ReminderStatus(normalized as "pending" | "sent" | "canceled" | "failed"));
  }

  static pending(): ReminderStatus {
    return new ReminderStatus(ReminderStatus.PENDING);
  }

  static sent(): ReminderStatus {
    return new ReminderStatus(ReminderStatus.SENT);
  }

  static canceled(): ReminderStatus {
    return new ReminderStatus(ReminderStatus.CANCELED);
  }

  static failed(): ReminderStatus {
    return new ReminderStatus(ReminderStatus.FAILED);
  }

  isPending(): boolean {
    return this.value === ReminderStatus.PENDING;
  }

  isSent(): boolean {
    return this.value === ReminderStatus.SENT;
  }

  isCanceled(): boolean {
    return this.value === ReminderStatus.CANCELED;
  }

  isFailed(): boolean {
    return this.value === ReminderStatus.FAILED;
  }

  /**
   * Checks if the reminder can be modified (canceled or rescheduled).
   */
  canModify(): boolean {
    return this.isPending();
  }

  toString(): string {
    return this.value;
  }

  equals(other: ReminderStatus): boolean {
    return this.value === other.value;
  }
}
