-- Deal, DealField, DealFieldOption models

CREATE TABLE "Deal" (
  "id"           TEXT NOT NULL,
  "contact_id"   TEXT NOT NULL,
  "field_values" JSONB,
  "user_id"      TEXT NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealField" (
  "id"          TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "field_key"   TEXT NOT NULL,
  "field_type"  TEXT NOT NULL,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "is_required" BOOLEAN NOT NULL DEFAULT false,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "config"      TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealFieldOption" (
  "id"         TEXT NOT NULL,
  "field_id"   TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DealFieldOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealField_field_key_key" ON "DealField"("field_key");

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DealFieldOption" ADD CONSTRAINT "DealFieldOption_field_id_fkey"
  FOREIGN KEY ("field_id") REFERENCES "DealField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: initial DealField records
INSERT INTO "DealField" ("id","label","field_key","field_type","sort_order","is_required","is_active") VALUES
  ('df-001','Deal Name',            'deal_name',                      'text',     0,  true,  true),
  ('df-002','Value (EUR)',           'value',                          'text',     1,  false, true),
  ('df-003','Pipeline',              'pipeline',                       'select',   2,  false, true),
  ('df-004','Status STG1',           'status_stg1',                    'select',   3,  false, true),
  ('df-005','Status STG2',           'status_stg2',                    'select',   4,  false, true),
  ('df-006','Spol',                  'spol',                           'text',     5,  false, true),
  ('df-007','Note #1',               'note_1',                         'textarea', 6,  false, true),
  ('df-008','Termin Rezervacije Posveta #1','termin_rezervacije_posveta_1','datetime',7,false, true),
  ('df-009','Note #2',               'note_2',                         'textarea', 8,  false, true),
  ('df-010','D_Datum Kreacije Dela', 'd_datum_kreacije_dela',           'datetime', 9,  false, true),
  ('df-011','Koda za Popust',        'koda_za_popust',                  'text',     10, false, true);

-- Seed: Pipeline options
INSERT INTO "DealFieldOption" ("id","field_id","label","value","sort_order") VALUES
  ('dfo-001','df-003','Prijava na brezplacno predstavitev','prijava_na_brezplacno_predstavitev',0),
  ('dfo-002','df-003','Prijava na tecaj',                  'prijava_na_tecaj',                  1),
  ('dfo-003','df-003','Odpoved pogodbe',                   'odpoved_pogodbe',                   2);
