import { Result, ok, err } from "../core/Result";

/**
 * ISO DateTime value object.
 * Represents a full timestamp in ISO 8601 format with timezone.
 * Used for reminder scheduling.
 */
export class ISODateTime {
  private readonly value: Date;

  private constructor(value: Date) {
    this.value = value;
  }

  /**
   * Creates an ISODateTime from an ISO string.
   * Validates format and parses to Date.
   */
  static create(value: string): Result<ISODateTime, string> {
    if (!value || value.trim().length === 0) {
      return err("DateTime cannot be empty");
    }

    // Parse ISO string
    const date = new Date(value);

    // Check for invalid date
    if (isNaN(date.getTime())) {
      return err("Invalid ISO datetime format");
    }

    return ok(new ISODateTime(date));
  }

  /**
   * Creates an ISODateTime from a Date object.
   */
  static fromDate(date: Date): Result<ISODateTime, string> {
    if (!date || isNaN(date.getTime())) {
      return err("Invalid date");
    }
    return ok(new ISODateTime(new Date(date)));
  }

  /**
   * Checks if this datetime is in the future.
   * @param toleranceMs Tolerance in milliseconds (default 2000ms = 2s)
   */
  isFuture(toleranceMs: number = 2000): boolean {
    const now = Date.now();
    return this.value.getTime() > now - toleranceMs;
  }

  /**
   * Returns milliseconds until this datetime.
   * Returns 0 if already passed.
   */
  msUntil(): number {
    const diff = this.value.getTime() - Date.now();
    return Math.max(0, diff);
  }

  /**
   * Returns the Date object.
   */
  toDate(): Date {
    return new Date(this.value);
  }

  /**
   * Returns the ISO string representation.
   */
  toString(): string {
    return this.value.toISOString();
  }

  /**
   * Returns Unix timestamp in milliseconds.
   */
  toUnixMs(): number {
    return this.value.getTime();
  }

  /**
   * Checks equality with another ISODateTime.
   */
  equals(other: ISODateTime): boolean {
    return this.value.getTime() === other.value.getTime();
  }
}
