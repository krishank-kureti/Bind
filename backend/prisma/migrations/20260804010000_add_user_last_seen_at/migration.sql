-- Track last app activity for periodic sync eligibility (active users only).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

-- Backfill: treat existing users as active once at deploy so current users
-- stay in the sync window until real activity takes over.
UPDATE "users" SET "lastSeenAt" = CURRENT_TIMESTAMP WHERE "lastSeenAt" IS NULL;

CREATE INDEX IF NOT EXISTS "users_lastSeenAt_idx" ON "users"("lastSeenAt");
