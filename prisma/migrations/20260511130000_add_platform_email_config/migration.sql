ALTER TABLE "Platform" ADD COLUMN "smtp_host"    TEXT;
ALTER TABLE "Platform" ADD COLUMN "smtp_port"    INTEGER;
ALTER TABLE "Platform" ADD COLUMN "smtp_user"    TEXT;
ALTER TABLE "Platform" ADD COLUMN "smtp_pass"    TEXT;
ALTER TABLE "Platform" ADD COLUMN "smtp_from"    TEXT;
ALTER TABLE "Platform" ADD COLUMN "smtp_secure"  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Platform" ADD COLUMN "imap_host"    TEXT;
ALTER TABLE "Platform" ADD COLUMN "imap_port"    INTEGER;
ALTER TABLE "Platform" ADD COLUMN "imap_user"    TEXT;
ALTER TABLE "Platform" ADD COLUMN "imap_pass"    TEXT;
ALTER TABLE "Platform" ADD COLUMN "imap_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Platform" ADD COLUMN "imap_last_sync" TIMESTAMP(3);

UPDATE "Platform"
SET smtp_host    = 'smtp.gmail.com',
    smtp_port    = 465,
    smtp_user    = 'info@evalley.si',
    smtp_pass    = 'rcsb oqcf glij rauw',
    smtp_from    = 'info@evalley.si',
    smtp_secure  = true,
    imap_host    = 'imap.gmail.com',
    imap_port    = 993,
    imap_user    = 'info@evalley.si',
    imap_pass    = 'rcsb oqcf glij rauw',
    imap_enabled = true
WHERE slug = 'evalley';
