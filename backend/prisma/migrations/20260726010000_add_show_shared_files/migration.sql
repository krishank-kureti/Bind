-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "showSharedFiles" BOOLEAN NOT NULL DEFAULT false;
