import { Result, ok, err } from "../core/Result";

/**
 * PasswordResetTokenValue value object.
 * Opaque reset token. Same rules as RefreshTokenValue.
 *
 * Invariants:
 * - Must be a non-empty string
 * - Minimum 32 characters
 * - toString() returns the token string
 */
export class PasswordResetTokenValue {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a PasswordResetTokenValue from a token string.
   */
  static create(input: string): Result<PasswordResetTokenValue> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return err("Password reset token must not be empty");
    }

    if (trimmed.length < 32) {
      return err(
        "Password reset token must be at least 32 characters"
      );
    }

    return ok(new PasswordResetTokenValue(input));
  }

  /**
   * Returns the token string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another PasswordResetTokenValue.
   */
  equals(other: PasswordResetTokenValue): boolean {
    return this.value === other.value;
  }
}
