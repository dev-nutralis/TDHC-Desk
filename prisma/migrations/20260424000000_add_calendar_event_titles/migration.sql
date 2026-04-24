CREATE TABLE "CalendarEventTitle" (
  "id"         TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventTitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarEventTitle_label_key" ON "CalendarEventTitle"("label");
