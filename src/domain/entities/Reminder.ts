import { Result, ok, err } from "../core/Result";
import { ISODateTime } from "../value-objects/ISODateTime";
import { Channel } from "../value-objects/Channel";
import { ReminderStatus } from "../value-objects/ReminderStatus";

/**
 * Props for creating a Reminder entity.
 */
export interface ReminderProps {
  id: string;
  userId: string;
  entryId: string;
  scheduledAt: string | Date;
  channel: string;
  message: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Props for updating a Reminder.
 */
export interface ReminderUpdateProps {
  scheduledAt?: string | Date;
  channel?: string;
  message?: string | null;
  status?: "canceled";
}

/**
 * Reminder entity representing a scheduled notification for an entry.
 * Business rules:
 * - scheduledAt must be a valid datetime
 * - Can only be modified (canceled/rescheduled) if status is "pending"
 */
export class Reminder {
  readonly id: string;
  readonly userId: string;
  readonly entryId: string;
  readonly scheduledAt: ISODateTime;
  readonly channel: Channel;
  readonly message: string | null;
  readonly status: ReminderStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    id: string,
    userId: string,
    entryId: string,
    scheduledAt: ISODateTime,
    channel: Channel,
    message: string | null,
    status: ReminderStatus,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.entryId = entryId;
    this.scheduledAt = scheduledAt;
    this.channel = channel;
    this.message = message;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Creates a Reminder entity from raw props.
   */
  static create(props: ReminderProps): Result<Reminder, string> {
    // Validate id
    if (!props.id || props.id.trim().length === 0) {
      return err("Reminder id cannot be empty");
    }

    // Validate userId
    if (!props.userId || props.userId.trim().length === 0) {
      return err("Reminder userId cannot be empty");
    }

    // Validate entryId
    if (!props.entryId || props.entryId.trim().length === 0) {
      return err("Reminder entryId cannot be empty");
    }

    // Validate scheduledAt
    const scheduledAtStr =
      props.scheduledAt instanceof Date
        ? props.scheduledAt.toISOString()
        : props.scheduledAt;
    const scheduledAtResult = ISODateTime.create(scheduledAtStr);
    if (scheduledAtResult.isErr()) {
      return err(scheduledAtResult.error);
    }

    // Validate channel
    const channelResult = Channel.create(props.channel);
    if (channelResult.isErr()) {
      return err(channelResult.error);
    }

    // Validate status
    const statusResult = ReminderStatus.create(props.status);
    if (statusResult.isErr()) {
      return err(statusResult.error);
    }

    // Message can be null or string (no validation needed)

    return ok(
      new Reminder(
        props.id.trim(),
        props.userId.trim(),
        props.entryId.trim(),
        scheduledAtResult.value,
        channelResult.value,
        props.message,
        statusResult.value,
        props.createdAt,
        props.updatedAt,
      ),
    );
  }

  /**
   * Checks if this reminder can be modified (canceled or rescheduled).
   */
  canModify(): boolean {
    return this.status.canModify();
  }

  /**
   * Creates a new Reminder with updated fields.
   * Returns error if updates violate business rules.
   */
  withUpdates(updates: ReminderUpdateProps): Result<Reminder, string> {
    // Business rule: can only modify if pending
    if (!this.canModify()) {
      return err(
        `Cannot modify reminder with status: ${this.status.toString()}`,
      );
    }

    // Handle status update (cancel)
    let newStatus = this.status;
    if (updates.status === "canceled") {
      newStatus = ReminderStatus.canceled();
    }

    // Handle scheduledAt update
    let newScheduledAt = this.scheduledAt;
    if (updates.scheduledAt !== undefined) {
      const scheduledAtStr =
        updates.scheduledAt instanceof Date
          ? updates.scheduledAt.toISOString()
          : updates.scheduledAt;
      const scheduledAtResult = ISODateTime.create(scheduledAtStr);
      if (scheduledAtResult.isErr()) {
        return err(scheduledAtResult.error);
      }
      newScheduledAt = scheduledAtResult.value;
    }

    // Handle channel update
    let newChannel = this.channel;
    if (updates.channel !== undefined) {
      const channelResult = Channel.create(updates.channel);
      if (channelResult.isErr()) {
        return err(channelResult.error);
      }
      newChannel = channelResult.value;
    }

    // Handle message update (can be string or null)
    const newMessage =
      updates.message !== undefined ? updates.message : this.message;

    return ok(
      new Reminder(
        this.id,
        this.userId,
        this.entryId,
        newScheduledAt,
        newChannel,
        newMessage,
        newStatus,
        this.createdAt,
        new Date(),
      ),
    );
  }

  /**
   * Creates a new Reminder with sent status.
   */
  markSent(): Reminder {
    return new Reminder(
      this.id,
      this.userId,
      this.entryId,
      this.scheduledAt,
      this.channel,
      this.message,
      ReminderStatus.sent(),
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Creates a new Reminder with failed status.
   */
  markFailed(): Reminder {
    return new Reminder(
      this.id,
      this.userId,
      this.entryId,
      this.scheduledAt,
      this.channel,
      this.message,
      ReminderStatus.failed(),
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Returns a plain object representation.
   */
  toJSON(): {
    id: string;
    userId: string;
    entryId: string;
    scheduledAt: string;
    channel: string;
    message: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      userId: this.userId,
      entryId: this.entryId,
      scheduledAt: this.scheduledAt.toString(),
      channel: this.channel.toString(),
      message: this.message,
      status: this.status.toString(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
