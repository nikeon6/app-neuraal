import { Result, ok, err } from "../core/Result";

/**
 * Password value object.
 * Represents raw password validation (NOT hashing).
 *
 * Invariants:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*()_+-=[]{}|;':",./<>?)
 * - Max 128 characters
 */
export class Password {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  private static readonly SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?";

  /**
   * Creates a Password from a raw string.
   * Validates all password requirements.
   */
  static create(input: string): Result<Password> {
    if (input.length < 8) {
      return err("Password must be at least 8 characters");
    }

    if (input.length > 128) {
      return err("Password must not exceed 128 characters");
    }

    if (!/[A-Z]/.test(input)) {
      return err("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(input)) {
      return err("Password must contain at least one lowercase letter");
    }

    if (!/[0-9]/.test(input)) {
      return err("Password must contain at least one number");
    }

    const hasSpecial = [...Password.SPECIAL_CHARS].some((char) =>
      input.includes(char),
    );
    if (!hasSpecial) {
      return err("Password must contain at least one special character");
    }

    return ok(new Password(input));
  }

  /**
   * Returns the raw password string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another Password (compares raw strings).
   */
  equals(other: Password): boolean {
    return this.value === other.value;
  }
}
