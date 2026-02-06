import { Result, ok, err } from "../core/Result";

/**
 * TopicName value object.
 * Represents a valid topic name with length constraints.
 * 
 * Invariants:
 * - Cannot be empty or whitespace-only
 * - Must be between 2 and 50 characters (after trim)
 * - Stored trimmed
 */
export class TopicName {
  private static readonly MIN_LENGTH = 2;
  private static readonly MAX_LENGTH = 50;

  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a TopicName from a string.
   * Trims whitespace and validates length constraints.
   */
  static create(input: string): Result<TopicName> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return err("Topic name cannot be empty");
    }

    if (trimmed.length < TopicName.MIN_LENGTH) {
      return err(
        `Topic name must be at least ${TopicName.MIN_LENGTH} characters`
      );
    }

    if (trimmed.length > TopicName.MAX_LENGTH) {
      return err(
        `Topic name must be at most ${TopicName.MAX_LENGTH} characters`
      );
    }

    return ok(new TopicName(trimmed));
  }

  /**
   * Returns the topic name string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another TopicName (case-sensitive).
   */
  equals(other: TopicName): boolean {
    return this.value === other.value;
  }

  /**
   * Checks equality with another TopicName (case-insensitive).
   * Useful for duplicate detection.
   */
  equalsIgnoreCase(other: TopicName): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase();
  }
}
