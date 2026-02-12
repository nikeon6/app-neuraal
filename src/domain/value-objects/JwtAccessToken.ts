import { Result, ok, err } from "../core/Result";

/**
 * JwtAccessToken value object.
 * Signed JWT string wrapper.
 *
 * Invariants:
 * - Must be a non-empty string
 * - Must contain exactly 2 dots (header.payload.signature format)
 * - create() validates format
 * - toString() returns the JWT string
 */
export class JwtAccessToken {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a JwtAccessToken from a JWT string.
   * Validates that the string has header.payload.signature format (exactly 2 dots).
   */
  static create(input: string): Result<JwtAccessToken> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return err("JWT access token must not be empty");
    }

    const parts = trimmed.split(".");
    if (parts.length !== 3) {
      return err(
        "JWT must have header.payload.signature format (exactly 2 dots)"
      );
    }

    const [header, payload, signature] = parts;
    if (!header || !payload || !signature) {
      return err(
        "JWT must have non-empty header, payload, and signature parts"
      );
    }

    return ok(new JwtAccessToken(input));
  }

  /**
   * Returns the JWT string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another JwtAccessToken.
   */
  equals(other: JwtAccessToken): boolean {
    return this.value === other.value;
  }
}
