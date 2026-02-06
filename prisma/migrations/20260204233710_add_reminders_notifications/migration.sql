-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "message" VARCHAR(500),
    "status" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_user_id_idx" ON "reminders"("user_id");

-- CreateIndex
CREATE INDEX "reminders_entry_id_idx" ON "reminders"("entry_id");

-- CreateIndex
CREATE INDEX "reminders_scheduled_at_idx" ON "reminders"("scheduled_at");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
