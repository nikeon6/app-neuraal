import { Result, ok, err } from "../core/Result";

export type SummaryFormat = "markdown" | "plain";

/**
 * SummaryText value object.
 * Represents the summary content of an entry with format information.
 */
export class SummaryText {
  private readonly value: string;
  private readonly format: SummaryFormat;

  static readonly MAX_LENGTH = 10000;
  static readonly VALID_FORMATS: SummaryFormat[] = ["markdown", "plain"];

  private constructor(value: string, format: SummaryFormat) {
    this.value = value;
    this.format = format;
  }

  static create(
    value: string,
    format: SummaryFormat = "markdown"
  ): Result<SummaryText, string> {
    if (!value || value.trim().length === 0) {
      return err("Summary cannot be empty");
    }

    const trimmed = value.trim();

    if (trimmed.length > SummaryText.MAX_LENGTH) {
      return err(`Summary cannot exceed ${SummaryText.MAX_LENGTH} characters`);
    }

    if (!SummaryText.VALID_FORMATS.includes(format)) {
      return err(`Invalid format. Allowed: ${SummaryText.VALID_FORMATS.join(", ")}`);
    }

    return ok(new SummaryText(trimmed, format));
  }

  toString(): string {
    return this.value;
  }

  getFormat(): SummaryFormat {
    return this.format;
  }

  isMarkdown(): boolean {
    return this.format === "markdown";
  }

  isPlain(): boolean {
    return this.format === "plain";
  }

  length(): number {
    return this.value.length;
  }

  equals(other: SummaryText): boolean {
    return this.value === other.value && this.format === other.format;
  }
}
