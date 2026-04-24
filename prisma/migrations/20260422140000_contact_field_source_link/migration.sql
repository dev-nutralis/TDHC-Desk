-- Add source linking columns to ContactField
-- source_module: which module the field was imported from (e.g. "leads")
-- source_field_id: the ID of the original field in that module
ALTER TABLE "ContactField" ADD COLUMN "source_module" TEXT;
ALTER TABLE "ContactField" ADD COLUMN "source_field_id" TEXT;
