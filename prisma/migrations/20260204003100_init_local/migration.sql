-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "topic_id" TEXT,
    "completed" BOOLEAN,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "storage_key" VARCHAR(1024) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topics_user_id_idx" ON "topics"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_user_id_name_key" ON "topics"("user_id", "name");

-- CreateIndex
CREATE INDEX "entries_user_id_date_idx" ON "entries"("user_id", "date");

-- CreateIndex
CREATE INDEX "attachments_user_id_idx" ON "attachments"("user_id");

-- CreateIndex
CREATE INDEX "attachments_entry_id_idx" ON "attachments"("entry_id");
