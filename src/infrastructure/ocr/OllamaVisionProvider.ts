import type { OcrPort } from "@/application/ports/OcrPort";

/**
 * Configuration for the Ollama Vision provider.
 */
export interface OllamaVisionConfig {
  /** Ollama base URL, e.g. "http://localhost:11434" */
  baseUrl: string;
  /** Vision model name, e.g. "glm-ocr" */
  model: string;
  /** Request timeout in milliseconds (default: 90_000 — generous for large images) */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/** Prompt used for OCR / text extraction mode. */
export const PROMPT_SCAN_TEXT =
  "Analyze this image and extract all visible text. Return the extracted text in a clean, structured format. Preserve the original layout as much as possible.";

/** Prompt used for image description mode. */
export const PROMPT_DESCRIBE =
  "Describe the image in detail, including the objects, colors, shapes, and any other details.";

/**
 * Ollama Vision implementation of OcrPort.
 *
 * Uses Ollama's /api/generate endpoint with image support to analyze
 * images using a vision-capable model (e.g. glm-ocr).
 *
 * API: POST {baseUrl}/api/generate
 * Request: { model, prompt, images: [base64], stream: false }
 * Response: { response: "text", ... }
 */
export class OllamaVisionProvider implements OcrPort {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: OllamaVisionConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async extractText(
    imageBase64: string,
    _mimeType: string,
    prompt?: string
  ): Promise<string> {
    const url = `${this.baseUrl}/api/generate`;
    const effectivePrompt = prompt ?? PROMPT_SCAN_TEXT;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: effectivePrompt,
          images: [imageBase64],
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Ollama Vision request failed: ${response.status} ${response.statusText} - ${body}`
        );
      }

      const data = (await response.json()) as {
        response?: string;
        error?: string;
      };

      if (data.error) {
        throw new Error(`Ollama Vision error: ${data.error}`);
      }

      if (!data.response) {
        throw new Error("Ollama Vision returned empty response");
      }

      return data.response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          `Ollama Vision request timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
