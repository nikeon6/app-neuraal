import { Result, ok, err } from "../core/Result";

/**
 * Email value object.
 * Represents a validated email address.
 *
 * Invariants:
 * - Must contain exactly one @
 * - Must have non-empty local and domain parts
 * - Domain must contain at least one .
 * - Max 254 characters
 * - Stored normalized to lowercase, trimmed
 */
export class Email {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates an Email from a string.
   * Validates format and normalizes to lowercase, trimmed.
   */
  static create(input: string): Result<Email> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return err("Email must not be empty");
    }

    if (trimmed.length > 254) {
      return err("Email must not exceed 254 characters");
    }

    const atCount = (trimmed.match(/@/g) ?? []).length;
    if (atCount !== 1) {
      return err("Email must contain exactly one @");
    }

    const [local, domain] = trimmed.split("@");
    if (!local || local.length === 0) {
      return err("Email must have a non-empty local part");
    }
    if (!domain || domain.length === 0) {
      return err("Email must have a non-empty domain part");
    }
    if (!domain.includes(".")) {
      return err("Email domain must contain at least one .");
    }

    const normalized = trimmed.toLowerCase();

    return ok(new Email(normalized));
  }

  /**
   * Returns the email string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another Email.
   */
  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
