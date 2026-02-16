-- CreateIndex (idempotent)
-- Enforce per-user color uniqueness at the DB level to prevent race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS "topics_user_id_color_key" ON "topics"("user_id", "color");
