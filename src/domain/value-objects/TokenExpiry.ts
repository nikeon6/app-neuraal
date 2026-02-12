import { Result, ok, err } from "../core/Result";

/**
 * TokenExpiry value object.
 * Expiry date validation.
 *
 * Invariants:
 * - Must be a Date object
 * - Must be in the future (compared to an optional `now` parameter, defaulting to `new Date()`)
 * - toDate() returns the Date
 * - isExpired(now?: Date): boolean — returns true if now >= expiresAt
 */
export class TokenExpiry {
  private readonly value: Date;

  private constructor(value: Date) {
    this.value = value;
  }

  /**
   * Creates a TokenExpiry from a Date.
   * Validates that the expiry is in the future.
   */
  static create(
    expiresAt: Date,
    now: Date = new Date()
  ): Result<TokenExpiry> {
    if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime())) {
      return err("Token expiry must be a valid Date object");
    }

    if (expiresAt.getTime() <= now.getTime()) {
      return err("Token expiry must be in the future");
    }

    return ok(new TokenExpiry(expiresAt));
  }

  /**
   * Returns the expiry Date.
   */
  toDate(): Date {
    return this.value;
  }

  /**
   * Returns true if the token is expired (now >= expiresAt).
   */
  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this.value.getTime();
  }

  /**
   * Checks equality with another TokenExpiry.
   */
  equals(other: TokenExpiry): boolean {
    return this.value.getTime() === other.value.getTime();
  }
}
