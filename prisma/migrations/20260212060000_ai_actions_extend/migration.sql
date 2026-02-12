-- Extend AiActionType enum with new actions
ALTER TYPE "AiActionType" ADD VALUE IF NOT EXISTS 'TRANSCRIPT_YOUTUBE';
ALTER TYPE "AiActionType" ADD VALUE IF NOT EXISTS 'OCR_IMAGE';
ALTER TYPE "AiActionType" ADD VALUE IF NOT EXISTS 'REMINDER_WHATSAPP';

-- Add transcript and OCR fields to entries
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "transcript_text" TEXT;
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "transcript_updated_at" TIMESTAMP(3);
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "ocr_text" TEXT;
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "ocr_updated_at" TIMESTAMP(3);

-- Add meta, submittedAt, doneAt, failedAt to transcription_requests
ALTER TABLE "transcription_requests" ADD COLUMN IF NOT EXISTS "meta" JSONB;
ALTER TABLE "transcription_requests" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);
ALTER TABLE "transcription_requests" ADD COLUMN IF NOT EXISTS "done_at" TIMESTAMP(3);
ALTER TABLE "transcription_requests" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3);
