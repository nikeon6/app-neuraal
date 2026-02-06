import type { EmbeddingProviderPort } from "@/application/ports/EmbeddingProviderPort";

/**
 * Configuration for the Ollama embedding provider.
 */
export interface OllamaEmbeddingConfig {
  baseUrl: string; // e.g. "http://localhost:11434"
  model: string; // e.g. "nomic-embed-text-v2-moe:latest"
  timeoutMs?: number; // default 30000
}

/**
 * Ollama implementation of EmbeddingProviderPort.
 * Uses Ollama's /api/embed endpoint to generate embeddings.
 *
 * API: POST /api/embed
 * Request: { "model": "...", "input": "text" }
 * Response: { "model": "...", "embeddings": [[...]], ... }
 */
export class OllamaEmbeddingProvider implements EmbeddingProviderPort {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: OllamaEmbeddingConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // strip trailing slash
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  /**
   * Generates an embedding vector for the given text using Ollama.
   */
  async embedText(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/api/embed`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Ollama embed request failed: ${response.status} ${response.statusText} - ${body}`
        );
      }

      const data = (await response.json()) as {
        embeddings: number[][];
        model: string;
      };

      if (
        !data.embeddings ||
        !Array.isArray(data.embeddings) ||
        data.embeddings.length === 0
      ) {
        throw new Error("Ollama returned empty embeddings");
      }

      return data.embeddings[0];
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          `Ollama embed request timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
