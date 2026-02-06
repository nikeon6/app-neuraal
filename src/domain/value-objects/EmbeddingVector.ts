import { Result, ok, err } from "../core/Result";

/**
 * EmbeddingVector value object.
 * Represents a dense vector of floating point numbers produced by an embedding model.
 *
 * Invariants:
 * - Length must equal the expected dimension
 * - All values must be finite numbers (no NaN, no Infinity)
 * - Immutable (returns copies)
 */
export class EmbeddingVector {
  private readonly values: Float64Array;
  readonly dimension: number;

  private constructor(values: Float64Array) {
    this.values = values;
    this.dimension = values.length;
  }

  /**
   * Creates an EmbeddingVector from an array of numbers.
   * @param values - The embedding values
   * @param expectedDim - The expected dimension (e.g. 768)
   */
  static create(values: number[], expectedDim: number): Result<EmbeddingVector> {
    if (values.length !== expectedDim) {
      return err(
        `Embedding dimension mismatch: expected ${expectedDim}, got ${values.length}`
      );
    }

    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) {
        return err(
          `Embedding values must be finite numbers. Found non-finite value at index ${i}`
        );
      }
    }

    return ok(new EmbeddingVector(Float64Array.from(values)));
  }

  /**
   * Returns a plain number array copy of the vector.
   */
  toArray(): number[] {
    return Array.from(this.values);
  }

  /**
   * Returns a pgvector-compatible string representation: [0.1,0.2,0.3]
   */
  toPgVector(): string {
    return `[${this.toArray().join(",")}]`;
  }

  /**
   * Computes cosine distance between this vector and another.
   * cosine_distance = 1 - cosine_similarity
   * Range: 0 (identical) to 2 (opposite)
   */
  cosineDistance(other: EmbeddingVector): number {
    if (this.dimension !== other.dimension) {
      throw new Error(
        `Cannot compute cosine distance: dimension mismatch (${this.dimension} vs ${other.dimension})`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < this.dimension; i++) {
      dotProduct += this.values[i] * other.values[i];
      normA += this.values[i] * this.values[i];
      normB += other.values[i] * other.values[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 1; // zero vectors → max distance

    const cosineSimilarity = dotProduct / magnitude;
    return 1 - cosineSimilarity;
  }
}
