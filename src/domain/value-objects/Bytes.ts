import { Result, ok, err } from "../core/Result";

/**
 * Bytes value object.
 * Represents a size in bytes with validation and utilities.
 */
export class Bytes {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  /**
   * Creates a Bytes value from a number.
   * Truncates decimals.
   */
  static create(value: number): Result<Bytes, string> {
    if (!Number.isFinite(value)) {
      return err("Bytes must be a finite number");
    }

    const truncated = Math.floor(value);

    if (truncated < 0) {
      return err("Bytes cannot be negative");
    }

    return ok(new Bytes(truncated));
  }

  /**
   * Creates a Bytes value directly (unsafe, for internal use).
   */
  static fromNumber(value: number): Bytes {
    return new Bytes(Math.floor(value));
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: Bytes): boolean {
    return this.value === other.value;
  }

  lessThan(other: Bytes): boolean {
    return this.value < other.value;
  }

  lessThanOrEqual(other: Bytes): boolean {
    return this.value <= other.value;
  }

  greaterThan(other: Bytes): boolean {
    return this.value > other.value;
  }

  greaterThanOrEqual(other: Bytes): boolean {
    return this.value >= other.value;
  }

  add(other: Bytes): Bytes {
    return new Bytes(this.value + other.value);
  }

  subtract(other: Bytes): Bytes {
    return new Bytes(Math.max(0, this.value - other.value));
  }

  /**
   * Formats bytes as human-readable string.
   */
  toHumanReadable(): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = this.value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Format with appropriate precision
    const formatted = unitIndex === 0 ? size.toString() : size.toFixed(0);
    return `${formatted} ${units[unitIndex]}`;
  }
}
