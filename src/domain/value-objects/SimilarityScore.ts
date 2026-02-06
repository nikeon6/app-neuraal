import { Result, ok, err } from "../core/Result";

/**
 * SimilarityScore value object.
 * Represents a similarity score between 0 (no similarity) and 1 (identical).
 *
 * Invariants:
 * - Value must be between 0 and 1 inclusive
 * - Must be a finite number
 */
export class SimilarityScore {
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  /**
   * Creates a SimilarityScore from a number in range [0, 1].
   */
  static create(value: number): Result<SimilarityScore> {
    if (!Number.isFinite(value)) {
      return err("Similarity score must be a finite number");
    }
    if (value < 0 || value > 1) {
      return err("Similarity score must be between 0 and 1");
    }
    return ok(new SimilarityScore(value));
  }

  /**
   * Creates a SimilarityScore from a cosine distance (0..2).
   * score = 1 - clamp(distance, 0, 1)
   *
   * Cosine distance ranges:
   *  0 = identical → score 1
   *  1 = orthogonal → score 0
   *  >1 = opposite → score 0 (clamped)
   */
  static fromCosineDistance(distance: number): Result<SimilarityScore> {
    const clamped = Math.max(0, Math.min(1, distance));
    return SimilarityScore.create(1 - clamped);
  }

  /**
   * Returns true if this score meets or exceeds the given threshold.
   */
  meetsThreshold(threshold: number): boolean {
    return this.value >= threshold;
  }
}
