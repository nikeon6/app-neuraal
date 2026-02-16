import { Result, ok, err } from "../core/Result";

/**
 * RefreshTokenValue value object.
 * Opaque refresh token (base64url string).
 *
 * Invariants:
 * - Must be a non-empty string
 * - Minimum 32 characters (a base64url-encoded 32-byte value)
 * - create() validates minimum length
 * - toString() returns the token string
 */
export class RefreshTokenValue {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a RefreshTokenValue from a base64url token string.
   */
  static create(input: string): Result<RefreshTokenValue> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return err("Refresh token must not be empty");
    }

    if (trimmed.length < 32) {
      return err(
        "Refresh token must be at least 32 characters (base64url-encoded 32-byte value)",
      );
    }

    return ok(new RefreshTokenValue(input));
  }

  /**
   * Returns the token string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another RefreshTokenValue.
   */
  equals(other: RefreshTokenValue): boolean {
    return this.value === other.value;
  }
}
