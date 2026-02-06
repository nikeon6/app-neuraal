import { Result, ok, err } from "../core/Result";

const VALID_TYPES = ["task", "note"] as const;
type EntryTypeValue = (typeof VALID_TYPES)[number];

/**
 * Entry type value object.
 * Represents the type of entry: "task" or "note".
 */
export class EntryType {
  private readonly value: EntryTypeValue;

  private constructor(value: EntryTypeValue) {
    this.value = value;
  }

  /**
   * Creates an EntryType from a string.
   * Only accepts "task" or "note" (case-sensitive, no trimming).
   */
  static create(value: string): Result<EntryType, string> {
    if (!VALID_TYPES.includes(value as EntryTypeValue)) {
      return err(`Entry type must be "task" or "note"`);
    }

    return ok(new EntryType(value as EntryTypeValue));
  }

  toString(): string {
    return this.value;
  }

  isTask(): boolean {
    return this.value === "task";
  }

  isNote(): boolean {
    return this.value === "note";
  }

  equals(other: EntryType): boolean {
    return this.value === other.value;
  }
}
