-- Add auth fields to User table (handle existing rows with defaults)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "first_name"    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "last_name"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "role"          TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop the old name column
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";

-- Create UserPlatform junction table
CREATE TABLE IF NOT EXISTS "UserPlatform" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPlatform_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPlatform_user_id_platform_id_key"
  ON "UserPlatform"("user_id", "platform_id");

ALTER TABLE "UserPlatform"
  ADD CONSTRAINT "UserPlatform_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserPlatform_platform_id_fkey"
    FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
