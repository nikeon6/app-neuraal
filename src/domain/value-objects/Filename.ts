import { Result, ok, err } from "../core/Result";

const MAX_LENGTH = 255;

/**
 * Filename value object.
 * Validates filename strings.
 */
export class Filename {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a Filename from a string.
   */
  static create(value: string): Result<Filename, string> {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return err("Filename cannot be empty");
    }

    if (trimmed.length > MAX_LENGTH) {
      return err(`Filename must be at most ${MAX_LENGTH} characters`);
    }

    return ok(new Filename(trimmed));
  }

  toString(): string {
    return this.value;
  }

  /**
   * Returns the file extension (lowercase, without dot).
   */
  extension(): string {
    const lastDot = this.value.lastIndexOf(".");
    if (lastDot === -1 || lastDot === this.value.length - 1) {
      return "";
    }
    return this.value.slice(lastDot + 1).toLowerCase();
  }

  /**
   * Returns the filename without extension.
   */
  baseName(): string {
    const lastDot = this.value.lastIndexOf(".");
    if (lastDot === -1) {
      return this.value;
    }
    return this.value.slice(0, lastDot);
  }

  equals(other: Filename): boolean {
    return this.value === other.value;
  }
}
