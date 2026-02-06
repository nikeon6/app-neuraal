import { Result, ok, err } from "../core/Result";

const VALID_STATUSES = ["pending", "ready", "deleted"] as const;
type AttachmentStatusValue = (typeof VALID_STATUSES)[number];

/**
 * AttachmentStatus value object.
 * Represents the lifecycle state of an attachment.
 */
export class AttachmentStatus {
  private readonly value: AttachmentStatusValue;

  private constructor(value: AttachmentStatusValue) {
    this.value = value;
  }

  /**
   * Creates an AttachmentStatus from a string.
   */
  static create(value: string): Result<AttachmentStatus, string> {
    if (!VALID_STATUSES.includes(value as AttachmentStatusValue)) {
      return err(`Attachment status must be "pending", "ready", or "deleted"`);
    }

    return ok(new AttachmentStatus(value as AttachmentStatusValue));
  }

  static pending(): AttachmentStatus {
    return new AttachmentStatus("pending");
  }

  static ready(): AttachmentStatus {
    return new AttachmentStatus("ready");
  }

  static deleted(): AttachmentStatus {
    return new AttachmentStatus("deleted");
  }

  toString(): string {
    return this.value;
  }

  isPending(): boolean {
    return this.value === "pending";
  }

  isReady(): boolean {
    return this.value === "ready";
  }

  isDeleted(): boolean {
    return this.value === "deleted";
  }

  /**
   * Returns true if attachment counts towards quotas (pending or ready).
   */
  isActive(): boolean {
    return this.value === "pending" || this.value === "ready";
  }

  equals(other: AttachmentStatus): boolean {
    return this.value === other.value;
  }
}
