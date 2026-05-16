ALTER TABLE "Platform" ADD COLUMN IF NOT EXISTS "klaviyo_api_key" TEXT;
ALTER TABLE "Platform" ADD COLUMN IF NOT EXISTS "klaviyo_pipeline_lists" JSONB;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "klaviyo_profile_id" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "klaviyo_synced_at" TIMESTAMPTZ;
