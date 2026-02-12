-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('SUMMARY');

-- CreateTable
CREATE TABLE "ai_usage_monthly" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AiActionType" NOT NULL,
    "month_key" TEXT NOT NULL,
    "requests_used" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AiActionType" NOT NULL,
    "request_id" TEXT,
    "model" VARCHAR(100),
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_cents" INTEGER,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_ledger_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "entry_summary_requests" ADD COLUMN "meta" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_monthly_user_id_action_month_key_key" ON "ai_usage_monthly"("user_id", "action", "month_key");

-- CreateIndex
CREATE INDEX "ai_usage_monthly_user_id_month_key_idx" ON "ai_usage_monthly"("user_id", "month_key");

-- CreateIndex
CREATE INDEX "ai_usage_ledger_user_id_action_created_at_idx" ON "ai_usage_ledger"("user_id", "action", "created_at");
