-- AlterTable (idempotent — a later migration may already have added this column)
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Re-add pgvector embedding column (not managed by Prisma, but Prisma tried to drop it)
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
