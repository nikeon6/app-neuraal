import { Result, ok, err } from "../core/Result";

/**
 * EmbeddingModelName value object.
 * Represents the name/identifier of an embedding model (e.g. "nomic-embed-text-v2-moe:latest").
 *
 * Invariants:
 * - Cannot be empty or whitespace-only
 * - Stored trimmed
 */
export class EmbeddingModelName {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates an EmbeddingModelName from a string.
   */
  static create(input: string): Result<EmbeddingModelName> {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return err("Embedding model name cannot be empty");
    }
    return ok(new EmbeddingModelName(trimmed));
  }

  toString(): string {
    return this.value;
  }

  equals(other: EmbeddingModelName): boolean {
    return this.value === other.value;
  }
}
