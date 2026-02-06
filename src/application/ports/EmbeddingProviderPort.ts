/**
 * Port (interface) for embedding generation.
 * Infrastructure layer will provide the concrete implementation (e.g. Ollama).
 */
export interface EmbeddingProviderPort {
  /**
   * Generates an embedding vector for the given text.
   * @param text - The input text to embed
   * @returns Array of numbers representing the embedding vector
   * @throws Error if the provider fails
   */
  embedText(text: string): Promise<number[]>;
}
