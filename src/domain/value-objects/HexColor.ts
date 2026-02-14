import { Result, ok, err } from "../core/Result";

/**
 * HexColor value object.
 * Represents a valid hex color in #RRGGBB format.
 *
 * Invariants:
 * - Must start with #
 * - Must have exactly 6 hex characters after #
 * - Stored normalized to lowercase
 */
export class HexColor {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a HexColor from a string.
   * Validates format and normalizes to lowercase.
   */
  static create(input: string): Result<HexColor> {
    const trimmed = input.trim();

    // Regex for #RRGGBB format (6 hex chars)
    const hexPattern = /^#[0-9a-fA-F]{6}$/;

    if (!hexPattern.test(trimmed)) {
      return err("Invalid hex color format. Must be #RRGGBB (e.g., #3b82f6)");
    }

    // Normalize to lowercase
    const normalized = trimmed.toLowerCase();

    return ok(new HexColor(normalized));
  }

  /**
   * Returns the hex color string.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks equality with another HexColor.
   */
  equals(other: HexColor): boolean {
    return this.value === other.value;
  }
}
