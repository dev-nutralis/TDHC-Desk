ALTER TABLE "KlaviyoForm"
  ADD COLUMN "create_deal"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deal_mappings" JSONB   NOT NULL DEFAULT '[]';
