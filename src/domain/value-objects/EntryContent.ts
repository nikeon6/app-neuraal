import { Result, ok, err } from "../core/Result";

/**
 * Entry content value object.
 * Represents the rich content of an entry (JSON object for editor).
 * Must be a non-null object (not array, not primitive).
 */
export class EntryContent {
  private readonly value: Record<string, unknown>;

  private constructor(value: Record<string, unknown>) {
    // Deep copy to ensure immutability
    this.value = JSON.parse(JSON.stringify(value));
  }

  /**
   * Creates an EntryContent from a JSON object.
   * Rejects null, undefined, primitives, and arrays.
   */
  static create(value: unknown): Result<EntryContent, string> {
    if (value === null || value === undefined) {
      return err("Content must be a JSON object, not null or undefined");
    }

    if (typeof value !== "object") {
      return err("Content must be a JSON object");
    }

    if (Array.isArray(value)) {
      return err("Content must be a JSON object, not an array");
    }

    return ok(new EntryContent(value as Record<string, unknown>));
  }

  /**
   * Returns a deep copy of the content object.
   */
  toJSON(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this.value));
  }

  /**
   * Compares content equality by deep JSON comparison.
   */
  equals(other: EntryContent): boolean {
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}
