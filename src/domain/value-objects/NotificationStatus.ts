import { Result, ok, err } from "../core/Result";

/**
 * NotificationStatus value object.
 * Represents the read status of a notification.
 */
export class NotificationStatus {
  private readonly value: "unread" | "read";

  static readonly UNREAD = "unread" as const;
  static readonly READ = "read" as const;

  private static readonly VALID_STATUSES = [
    NotificationStatus.UNREAD,
    NotificationStatus.READ,
  ] as const;

  private constructor(value: "unread" | "read") {
    this.value = value;
  }

  static create(value: string): Result<NotificationStatus, string> {
    if (!value || value.trim().length === 0) {
      return err("Status cannot be empty");
    }

    const normalized = value.trim().toLowerCase();

    if (
      !NotificationStatus.VALID_STATUSES.includes(
        normalized as (typeof NotificationStatus.VALID_STATUSES)[number],
      )
    ) {
      return err(
        `Invalid status. Allowed: ${NotificationStatus.VALID_STATUSES.join(", ")}`,
      );
    }

    return ok(new NotificationStatus(normalized as "unread" | "read"));
  }

  static unread(): NotificationStatus {
    return new NotificationStatus(NotificationStatus.UNREAD);
  }

  static read(): NotificationStatus {
    return new NotificationStatus(NotificationStatus.READ);
  }

  isUnread(): boolean {
    return this.value === NotificationStatus.UNREAD;
  }

  isRead(): boolean {
    return this.value === NotificationStatus.READ;
  }

  toString(): string {
    return this.value;
  }

  equals(other: NotificationStatus): boolean {
    return this.value === other.value;
  }
}
