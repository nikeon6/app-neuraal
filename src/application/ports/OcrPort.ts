/**
 * Port (interface) for image analysis via Vision AI.
 * Infrastructure layer will provide the concrete implementation (e.g. Ollama Vision).
 */
export interface OcrPort {
  /**
   * Analyzes an image with a given prompt.
   * @param imageBase64 - Base64-encoded image data (no data URI prefix)
   * @param mimeType - MIME type of the image (e.g. "image/png")
   * @param prompt - Optional prompt override (uses provider default if omitted)
   * @returns Text result from the vision model
   * @throws Error if processing fails or times out
   */
  extractText(
    imageBase64: string,
    mimeType: string,
    prompt?: string,
  ): Promise<string>;
}
