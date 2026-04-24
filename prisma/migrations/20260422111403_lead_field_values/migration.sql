-- Add field_values column
ALTER TABLE "Lead" ADD COLUMN "field_values" JSONB;

-- Migrate existing data: pack static columns into field_values JSON
UPDATE "Lead"
SET "field_values" = jsonb_strip_nulls(
  jsonb_build_object(
    'first_name', "first_name",
    'last_name',  "last_name",
    'nickname',   "nickname"
  )
);

-- Drop static columns
ALTER TABLE "Lead" DROP COLUMN "first_name";
ALTER TABLE "Lead" DROP COLUMN "last_name";
ALTER TABLE "Lead" DROP COLUMN "nickname";
