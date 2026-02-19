-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mark all existing users as verified so they are not locked out
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;
