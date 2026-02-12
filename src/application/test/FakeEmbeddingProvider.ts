import type { EmbeddingProviderPort } from "../ports/EmbeddingProviderPort";

/**
 * Fake embedding provider for testing.
 * Returns a deterministic vector based on the text input hash.
 */
export class FakeEmbeddingProvider implements EmbeddingProviderPort {
  /** Custom dimension for generated vectors */
  private dim: number;

  /** If set, embedText will throw with this error */
  shouldFail: Error | null = null;

  /** Track calls for assertions */
  calls: string[] = [];

  /** Pre-defined responses: text → vector */
  private responses: Map<string, number[]> = new Map();

  constructor(dim: number = 4096) {
    this.dim = dim;
  }

  /**
   * Register a specific response for a given text input.
   */
  setResponse(text: string, vector: number[]): void {
    this.responses.set(text, vector);
  }

  async embedText(text: string): Promise<number[]> {
    this.calls.push(text);

    if (this.shouldFail) {
      throw this.shouldFail;
    }

    // Return pre-defined response if available
    const predefined = this.responses.get(text);
    if (predefined) {
      return predefined;
    }

    // Generate deterministic vector from text hash
    return this.generateDeterministicVector(text);
  }

  /**
   * Generates a deterministic vector from a text string.
   * Uses a simple hash to seed the values, ensuring same text → same vector.
   */
  private generateDeterministicVector(text: string): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }

    const vector: number[] = [];
    for (let i = 0; i < this.dim; i++) {
      // Use hash + index to generate pseudo-random but deterministic values
      const seed = hash + i * 7919; // prime multiplier
      const value = Math.sin(seed) * 0.5;
      vector.push(value);
    }

    return vector;
  }
}
