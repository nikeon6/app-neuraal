import { Result, ok, err } from "../core/Result";

/**
 * Quota limit value object (>= 0) for monthly request/token limits.
 */
export class QuotaLimit {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create(value: number): Result<QuotaLimit, string> {
    if (!Number.isFinite(value)) {
      return err("Quota limit must be finite");
    }
    const n = Math.floor(value);
    if (n < 0) {
      return err("Quota limit cannot be negative");
    }
    return ok(new QuotaLimit(n));
  }

  static fromNumber(value: number): QuotaLimit {
    return new QuotaLimit(Math.max(0, Math.floor(value)));
  }

  toNumber(): number {
    return this.value;
  }

  isExceeded(used: number): boolean {
    return used >= this.value;
  }
}
