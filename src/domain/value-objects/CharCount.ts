import { Result, ok, err } from "../core/Result";

/**
 * Character count value object (>= 0) for input size limits.
 */
export class CharCount {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create(value: number): Result<CharCount, string> {
    if (!Number.isFinite(value)) {
      return err("Char count must be finite");
    }
    const n = Math.floor(value);
    if (n < 0) {
      return err("Char count cannot be negative");
    }
    return ok(new CharCount(n));
  }

  static fromNumber(value: number): CharCount {
    return new CharCount(Math.max(0, Math.floor(value)));
  }

  toNumber(): number {
    return this.value;
  }

  exceedsMax(maxChars: number): boolean {
    return this.value > maxChars;
  }

  /**
   * Truncates a string to at most maxChars and returns the truncated string.
   */
  static truncate(text: string, maxChars: number): string {
    if (maxChars <= 0) return "";
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }
}
