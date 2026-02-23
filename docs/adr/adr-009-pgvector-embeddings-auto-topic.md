# ADR-009: pgvector Embeddings for Auto-Topic Classification

- **Status:** Accepted
- **Date:** 2026-01-29
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — Slice 6: Embeddings + Auto-classification

---

## Context

Neuraal allows users to organize entries (tasks/notes) into Topics (user-defined categories). Manually assigning a topic to every entry adds friction. We want an **AI-assisted auto-classification** feature that suggests or assigns the most relevant topic based on the entry's text content.

Requirements:

- Must work locally without external API keys (privacy, cost, offline).
- Must scale to a moderate number of topics and entries per user.
- Similarity search should be fast and done in the database, not in application code.
- Threshold-based: only assign if confidence is high enough.

## Decision

Adopt a **local embedding + vector similarity** approach using:

1. **Ollama** (`qwen3-embedding:latest`) for generating 4096-dimensional text embeddings locally.
2. **pgvector** (PostgreSQL extension) for storing and searching embeddings using cosine distance (`<=>`).
3. **Synchronous API** for embedding operations (not queued), since Ollama runs locally with low latency.

### How it works

1. Each **Topic** gets an embedding generated from its name (via `POST /api/topics/:id/embedding/rebuild`).
2. When auto-topic is requested for an **Entry** (`POST /api/entries/:id/auto-topic`):
   - Extract plain text from `title` + rich `content` (TipTap/ProseMirror JSON).
   - Generate an embedding for the extracted text.
   - Query pgvector for the user's topic with the smallest cosine distance.
   - If `score = 1 - cosine_distance >= threshold`, assign the topic.
   - Return `{ selectedTopicId, score }`.
3. Configurable threshold via `AUTO_TOPIC_THRESHOLD` env var (default: 0.35).

### Persistence

- `Topic.embedding`: `vector(4096)` column managed via raw SQL (Prisma `Unsupported` type).
- `Topic.embeddingModel`: tracks which model generated the embedding.
- `Topic.embeddingUpdatedAt`: timestamp for cache invalidation.
- Vector index (HNSW or IVFFLAT) deferred until data volume warrants it.

### Domain modeling

- `EmbeddingVector` value object: validates dimension, finite values, provides `toPgVector()` and `cosineDistance()`.
- `SimilarityScore` value object: 0..1 range, `fromCosineDistance()`, `meetsThreshold()`.
- `EmbeddingModelName` value object: validated non-empty string.

## Consequences

### Positive

- Fully local: no external API costs or data leaving the server.
- Fast: Ollama embedding + pgvector search is sub-second for typical workloads.
- Extensible: same infrastructure supports future semantic search, duplicate detection, etc.
- Clean Architecture: threshold logic in Application layer, vector search in Infrastructure layer.

### Negative / Trade-offs

- Requires Ollama running alongside the app (Docker resource usage).
- Short topic names produce weaker embeddings (low similarity scores); richer topic descriptions would improve accuracy.
- Raw SQL needed for pgvector operations (Prisma doesn't natively support `vector` type).
- Embedding dimension is hardcoded to 4096; changing models requires re-embedding all topics.

## Alternatives Considered

1. **Keyword matching / TF-IDF**
   - Rejected: too brittle, poor semantic understanding.
2. **External embedding APIs (OpenAI, Cohere)**
   - Rejected for MVP: adds cost, latency, and external dependency; privacy concern.
3. **LLM-based classification (prompt a model to pick a topic)**
   - Considered: higher accuracy but much slower and expensive per request.
   - Could be added later as a complementary strategy.
4. **Embeddings stored in a dedicated vector DB (Qdrant, Weaviate)**
   - Rejected: pgvector is sufficient for the scale and avoids another service.

## Implementation Notes

- Plain text extraction from TipTap JSON: `src/shared/lib/extractPlainText.ts`.
- Ollama embedding provider: `src/infrastructure/embedding/OllamaEmbeddingProvider.ts`.
- pgvector queries use `pool.query` (raw `pg` client) since Prisma doesn't support vector columns natively.
- Threshold tuning: start at 0.35, adjust based on user feedback. Topics with richer descriptions will score higher.
- Future: Add HNSW index when topic count per user exceeds ~100.
