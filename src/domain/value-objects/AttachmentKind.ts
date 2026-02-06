import { Result, ok, err } from "../core/Result";

const VALID_KINDS = ["inline", "file"] as const;
type AttachmentKindValue = (typeof VALID_KINDS)[number];

/**
 * AttachmentKind value object.
 * Represents the type of attachment: "inline" (images in content) or "file" (downloadable files).
 */
export class AttachmentKind {
  private readonly value: AttachmentKindValue;

  private constructor(value: AttachmentKindValue) {
    this.value = value;
  }

  /**
   * Creates an AttachmentKind from a string.
   * Only accepts "inline" or "file" (case-sensitive, no trimming).
   */
  static create(value: string): Result<AttachmentKind, string> {
    if (!VALID_KINDS.includes(value as AttachmentKindValue)) {
      return err(`Attachment kind must be "inline" or "file"`);
    }

    return ok(new AttachmentKind(value as AttachmentKindValue));
  }

  static inline(): AttachmentKind {
    return new AttachmentKind("inline");
  }

  static file(): AttachmentKind {
    return new AttachmentKind("file");
  }

  toString(): string {
    return this.value;
  }

  isInline(): boolean {
    return this.value === "inline";
  }

  isFile(): boolean {
    return this.value === "file";
  }

  equals(other: AttachmentKind): boolean {
    return this.value === other.value;
  }
}
