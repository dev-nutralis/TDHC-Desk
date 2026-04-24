/*
  Warnings:

  - You are about to drop the column `afp_client` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `blacklist_reason` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `blacklisted` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `course_assignment` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `emails` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `exams` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `first_name` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `mobile_numbers` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `portal_assignment` on the `Contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "afp_client",
DROP COLUMN "blacklist_reason",
DROP COLUMN "blacklisted",
DROP COLUMN "course_assignment",
DROP COLUMN "emails",
DROP COLUMN "exams",
DROP COLUMN "first_name",
DROP COLUMN "gender",
DROP COLUMN "last_name",
DROP COLUMN "mobile_numbers",
DROP COLUMN "portal_assignment",
ADD COLUMN     "field_values" JSONB;

-- CreateTable
CREATE TABLE "ContactField" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactFieldOption" (
    "id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContactFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactField_field_key_key" ON "ContactField"("field_key");

-- AddForeignKey
ALTER TABLE "ContactFieldOption" ADD CONSTRAINT "ContactFieldOption_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "ContactField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
