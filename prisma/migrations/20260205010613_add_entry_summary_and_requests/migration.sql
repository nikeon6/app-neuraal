-- AlterTable
ALTER TABLE "entries" ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summary_format" VARCHAR(10),
ADD COLUMN     "summary_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "entry_summary_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entry_summary_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entry_summary_requests_user_id_idx" ON "entry_summary_requests"("user_id");

-- CreateIndex
CREATE INDEX "entry_summary_requests_entry_id_idx" ON "entry_summary_requests"("entry_id");

-- CreateIndex
CREATE INDEX "entry_summary_requests_status_idx" ON "entry_summary_requests"("status");
