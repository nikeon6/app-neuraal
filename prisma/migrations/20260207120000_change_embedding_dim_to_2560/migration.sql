-- Change embedding column dimension from vector(768) to vector(2560)
-- for qwen3-embedding:4b model.
--
-- pgvector does not support ALTER COLUMN TYPE for vector dimensions,
-- so we drop and recreate the column. Existing embeddings are invalidated
-- anyway when switching models (vectors are model-specific).

-- Drop the old 768-dim column (data is incompatible with the new model)
ALTER TABLE "topics" DROP COLUMN IF EXISTS "embedding";

-- Recreate with the new dimension (2560 for qwen3-embedding:4b)
ALTER TABLE "topics" ADD COLUMN "embedding" vector(2560);

-- Clear embedding metadata since vectors were dropped
UPDATE "topics" SET "embedding_model" = NULL, "embedding_updated_at" = NULL;
