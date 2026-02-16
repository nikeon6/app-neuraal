-- Change embedding column dimension from vector(2560) to vector(4096)
-- for qwen3-embedding:latest (8b) model.
--
-- pgvector does not support ALTER COLUMN TYPE for vector dimensions,
-- so we drop and recreate the column. Existing embeddings are invalidated
-- anyway when switching models (vectors are model-specific).

-- Drop the old 2560-dim column (data is incompatible with the new model)
ALTER TABLE "topics" DROP COLUMN IF EXISTS "embedding";

-- Recreate with the new dimension (4096 for qwen3-embedding:latest / 8b)
ALTER TABLE "topics" ADD COLUMN "embedding" vector(4096);

-- Clear embedding metadata since vectors were dropped
UPDATE "topics" SET "embedding_model" = NULL, "embedding_updated_at" = NULL;
