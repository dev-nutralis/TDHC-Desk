-- CreateTable
CREATE TABLE "ProfileFieldConfig" (
    "id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileFieldConfig_field_key_key" ON "ProfileFieldConfig"("field_key");
