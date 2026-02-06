import { Result, ok, err } from "../core/Result";
import { NotificationType } from "../value-objects/NotificationType";
import { NotificationStatus } from "../value-objects/NotificationStatus";

/**
 * Props for creating a Notification entity.
 */
export interface NotificationProps {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  status: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Notification entity representing an in-app notification.
 * Used to notify users about reminder status changes.
 */
export class Notification {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly status: NotificationStatus;
  readonly payload: Record<string, unknown> | null;
  readonly createdAt: Date;

  private constructor(
    id: string,
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    status: NotificationStatus,
    payload: Record<string, unknown> | null,
    createdAt: Date
  ) {
    this.id = id;
    this.userId = userId;
    this.type = type;
    this.title = title;
    this.message = message;
    this.status = status;
    this.payload = payload;
    this.createdAt = createdAt;
  }

  /**
   * Creates a Notification entity from raw props.
   */
  static create(props: NotificationProps): Result<Notification, string> {
    // Validate id
    if (!props.id || props.id.trim().length === 0) {
      return err("Notification id cannot be empty");
    }

    // Validate userId
    if (!props.userId || props.userId.trim().length === 0) {
      return err("Notification userId cannot be empty");
    }

    // Validate type
    const typeResult = NotificationType.create(props.type);
    if (typeResult.isErr()) {
      return err(typeResult.error);
    }

    // Validate title
    if (!props.title || props.title.trim().length === 0) {
      return err("Notification title cannot be empty");
    }

    // Validate message
    if (!props.message || props.message.trim().length === 0) {
      return err("Notification message cannot be empty");
    }

    // Validate status
    const statusResult = NotificationStatus.create(props.status);
    if (statusResult.isErr()) {
      return err(statusResult.error);
    }

    return ok(
      new Notification(
        props.id.trim(),
        props.userId.trim(),
        typeResult.value,
        props.title.trim(),
        props.message.trim(),
        statusResult.value,
        props.payload,
        props.createdAt
      )
    );
  }

  /**
   * Creates a new Notification marked as read.
   */
  markRead(): Notification {
    return new Notification(
      this.id,
      this.userId,
      this.type,
      this.title,
      this.message,
      NotificationStatus.read(),
      this.payload,
      this.createdAt
    );
  }

  /**
   * Returns a plain object representation.
   */
  toJSON(): {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    status: string;
    payload: Record<string, unknown> | null;
    createdAt: Date;
  } {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type.toString(),
      title: this.title,
      message: this.message,
      status: this.status.toString(),
      payload: this.payload,
      createdAt: this.createdAt,
    };
  }
}
