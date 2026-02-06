-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "embedding_model" VARCHAR(100),
ADD COLUMN     "embedding_updated_at" TIMESTAMP(3);

-- Add pgvector embedding column (not managed by Prisma)
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- TODO: Add HNSW or IVFFlat index for vector similarity search when data volume grows
-- CREATE INDEX IF NOT EXISTS "topics_embedding_hnsw_idx" ON "topics" USING hnsw ("embedding" vector_cosine_ops);
