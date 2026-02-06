import { Result, ok, err } from "../core/Result";

const MAX_LENGTH = 120;

/**
 * Entry title value object.
 * Represents the title of an entry (task or note).
 * Can be empty, max 120 characters after trimming.
 */
export class EntryTitle {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates an EntryTitle from a string.
   * Trims whitespace. Empty is allowed.
   */
  static create(value: string): Result<EntryTitle, string> {
    const trimmed = value.trim();

    if (trimmed.length > MAX_LENGTH) {
      return err(`Title must be at most ${MAX_LENGTH} characters`);
    }

    return ok(new EntryTitle(trimmed));
  }

  toString(): string {
    return this.value;
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  equals(other: EntryTitle): boolean {
    return this.value === other.value;
  }
}
