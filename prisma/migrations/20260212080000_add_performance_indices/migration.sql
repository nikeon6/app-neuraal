-- Performance indices for common query patterns

-- Notifications: filter unread by user
CREATE INDEX IF NOT EXISTS "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- Attachments: quota aggregation by user and status
CREATE INDEX IF NOT EXISTS "attachments_user_id_status_idx" ON "attachments"("user_id", "status");

-- Reminders: WhatsApp concurrency check per user
CREATE INDEX IF NOT EXISTS "reminders_user_id_channel_status_idx" ON "reminders"("user_id", "channel", "status");
