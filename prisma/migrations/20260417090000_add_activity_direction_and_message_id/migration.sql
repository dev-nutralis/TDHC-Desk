-- Add direction field (outbound by default) and email_message_id for dedup
ALTER TABLE "ContactActivity" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'outbound';
ALTER TABLE "ContactActivity" ADD COLUMN "email_message_id" TEXT;
CREATE UNIQUE INDEX "ContactActivity_email_message_id_key" ON "ContactActivity"("email_message_id");
