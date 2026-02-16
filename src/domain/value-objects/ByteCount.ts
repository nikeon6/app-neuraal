import { Result, ok, err } from "../core/Result";

/**
 * Byte count value object (>= 0) for input size limits (e.g. OCR image bytes).
 */
export class ByteCount {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create(value: number): Result<ByteCount, string> {
    if (!Number.isFinite(value)) {
      return err("Byte count must be finite");
    }
    const n = Math.floor(value);
    if (n < 0) {
      return err("Byte count cannot be negative");
    }
    return ok(new ByteCount(n));
  }

  static fromNumber(value: number): ByteCount {
    return new ByteCount(Math.max(0, Math.floor(value)));
  }

  toNumber(): number {
    return this.value;
  }

  exceedsMax(maxBytes: number): boolean {
    return this.value > maxBytes;
  }

  /**
   * Truncates a Buffer to at most maxBytes.
   */
  static truncate(buffer: Buffer, maxBytes: number): Buffer {
    if (maxBytes <= 0) return Buffer.alloc(0);
    if (buffer.length <= maxBytes) return buffer;
    return buffer.subarray(0, maxBytes);
  }
}
