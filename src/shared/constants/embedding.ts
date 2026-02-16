/**
 * Embedding configuration constants.
 * These can be overridden by environment variables:
 *   - EMBEDDING_DIM          → vector dimension (must match model output)
 *   - AUTO_TOPIC_THRESHOLD   → cosine-similarity cutoff
 *
 * Model presets:
 *   nomic-embed-text-v2-moe    → 768  dims
 *   qwen3-embedding:4b         → 2560 dims
 *   qwen3-embedding:latest(8b) → 4096 dims
 */

/** Default embedding dimension (matches qwen3-embedding:latest / 8b) */
export const DEFAULT_EMBEDDING_DIM = 4096;

/** Default similarity threshold for auto-topic assignment */
export const DEFAULT_AUTO_TOPIC_THRESHOLD = 0.35;
