import { Result, ok, err } from "../core/Result";

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Month key value object (YYYY-MM) for monthly quotas.
 */
export class MonthKey {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): Result<MonthKey, string> {
    if (!value || value.trim().length === 0) {
      return err("Month key cannot be empty");
    }
    const trimmed = value.trim();
    if (!MONTH_KEY_REGEX.test(trimmed)) {
      return err("Month key must be YYYY-MM");
    }
    const [, monthStr] = trimmed.split("-");
    const month = parseInt(monthStr, 10);
    if (month < 1 || month > 12) {
      return err("Invalid month");
    }
    return ok(new MonthKey(trimmed));
  }

  /**
   * Builds MonthKey from a Date (uses local year/month).
   */
  static fromDate(date: Date): MonthKey {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 0-indexed -> 1-12
    const value = `${year}-${month.toString().padStart(2, "0")}`;
    return new MonthKey(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: MonthKey): boolean {
    return this.value === other.value;
  }
}
