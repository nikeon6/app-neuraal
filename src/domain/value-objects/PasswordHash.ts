import { Result, ok, err } from "../core/Result";

/**
 * PasswordHash value object.
 * Represents a hashed password (bcrypt/argon2 output).
 *
 * Invariants:
 * - Must be a non-empty string
 */
export class PasswordHash {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a PasswordHash from a string.
   * Validates non-empty.
   */
  static create(input: string): Result<PasswordHash, string> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return err("Password hash cannot be empty");
    }

    return ok(new PasswordHash(input));
  }

  /**
   * Returns the hash string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another PasswordHash.
   */
  equals(other: PasswordHash): boolean {
    return this.value === other.value;
  }
}
