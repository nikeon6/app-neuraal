import { Result, ok, err } from "../core/Result";

/**
 * MimeType value object.
 * Validates and normalizes MIME type strings.
 */
export class MimeType {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a MimeType from a string.
   * Normalizes to lowercase and trims whitespace.
   */
  static create(value: string): Result<MimeType, string> {
    const trimmed = value.trim().toLowerCase();

    if (trimmed.length === 0) {
      return err("MIME type cannot be empty");
    }

    // Basic format validation: type/subtype
    if (!trimmed.includes("/")) {
      return err("MIME type must contain a slash (type/subtype)");
    }

    const parts = trimmed.split("/");
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      return err("Invalid MIME type format");
    }

    return ok(new MimeType(trimmed));
  }

  toString(): string {
    return this.value;
  }

  /**
   * Returns the category (type) part of the MIME type.
   */
  category(): string {
    return this.value.split("/")[0];
  }

  /**
   * Checks if this is an image MIME type.
   */
  isImage(): boolean {
    return this.category() === "image";
  }

  equals(other: MimeType): boolean {
    return this.value === other.value;
  }
}
