-- Add sort_order column to entries (missing from init migration)
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: transcription_requests
CREATE TABLE IF NOT EXISTS "transcription_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "youtube_url" VARCHAR(2048) NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcription_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transcription_requests_user_id_idx" ON "transcription_requests"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transcription_requests_entry_id_idx" ON "transcription_requests"("entry_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transcription_requests_status_idx" ON "transcription_requests"("status");
