import { Result, ok, err } from "../core/Result";

/**
 * ISO Date value object.
 * Represents a date in YYYY-MM-DD format.
 */
export class ISODate {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates an ISODate from a string.
   * Validates format and that the date actually exists.
   */
  static create(value: string): Result<ISODate, string> {
    // Check for empty/whitespace
    if (!value || value.trim().length === 0) {
      return err("Date cannot be empty");
    }

    // Strict format check: YYYY-MM-DD
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(value)) {
      return err("Date must be in YYYY-MM-DD format");
    }

    // Parse components
    const [yearStr, monthStr, dayStr] = value.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    // Validate month range
    if (month < 1 || month > 12) {
      return err("Invalid month");
    }

    // Validate day range (basic check)
    if (day < 1 || day > 31) {
      return err("Invalid day");
    }

    // Validate actual date existence (handles Feb 29, 30-day months, etc.)
    const dateObj = new Date(year, month - 1, day);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return err("Invalid date");
    }

    return ok(new ISODate(value));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ISODate): boolean {
    return this.value === other.value;
  }

  /**
   * Returns a Date object for this ISO date.
   * The time will be 00:00:00 in local timezone.
   */
  toDate(): Date {
    const [year, month, day] = this.value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
}
