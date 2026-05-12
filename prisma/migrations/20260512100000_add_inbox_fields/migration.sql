ALTER TABLE "ContactActivity" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContactActivity" ADD COLUMN "is_spam"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContactActivity" ADD COLUMN "is_read"  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ContactActivity" ADD COLUMN "thread_id" TEXT;
