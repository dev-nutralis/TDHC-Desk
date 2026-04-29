CREATE TABLE "KlaviyoForm" (
  "id"          TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "token"       TEXT NOT NULL,
  "mappings"    JSONB NOT NULL DEFAULT '[]',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KlaviyoForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KlaviyoForm_token_key" ON "KlaviyoForm"("token");

ALTER TABLE "KlaviyoForm"
  ADD CONSTRAINT "KlaviyoForm_platform_id_fkey"
    FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
