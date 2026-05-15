import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

const CSV_PATH = path.join(__dirname, "../export_mihajlo_20260515_0956.csv");
const PLATFORM_SLUG = "evalley";

// Contact IDs to skip (no matching contact found)
const SKIP_CONTACT_IDS = new Set(["578908522", "578908207"]);

// CSV column → deal field_key (field_type)
// Source [12] is intentionally omitted
const COL_TO_FIELD: Record<string, { key: string; type: string }> = {
  "Deal Name":                          { key: "deal_name",                         type: "text" },
  "Pipeline Stage":                     { key: "stage",                             type: "select" },
  "Value":                              { key: "value",                             type: "text" },
  "RAZLOG ZA IZGUBLJENO":               { key: "razlog_za_izgubljeno",              type: "select" },
  "RAZLOG ZA ODSTOP OD POGODBE":        { key: "razlog_za_odstop_od_pogodbe",       type: "select" },
  "RAZLOG ZA ZANIMANJE / NAKUP TEČAJA": { key: "razlog_za_zanimanje_nakup_teaja",   type: "select" },
  "STATUS_STG1":                        { key: "status_stg1",                       type: "select" },
  "STATUS_STG2":                        { key: "status_stg2",                       type: "select" },
  "STATUS_STG3":                        { key: "status_stg3",                       type: "select" },
  "Tags":                               { key: "tags",                              type: "select" },
  "TERMIN REZERVACIJE POSVETA #1":      { key: "termin_rezervacije_posveta_1",      type: "datetime" },
  "TERMIN REZERVACIJE POSVETA #2":      { key: "termin_rezervacije_posveta_2",      type: "datetime" },
  "VEZA I DEAL ID":                     { key: "veza_i_deal_id",                    type: "number" },
  "VRSTA PAKETA":                       { key: "vrsta_paketa",                      type: "select" },
  "ZNESEK PREDAJE NA IZTERJAVO":        { key: "znesek_predaje_na_izterjavo",       type: "text" },
  "AFFILIATE PARTNER":                  { key: "affiliate_partner",                 type: "text" },
  "CONTACT ID (V TABELI PRODANIH)":     { key: "contact_id_v_tabeli_prodanih",      type: "number" },
  "D_DATUM KREACIJE DEALA":             { key: "d_datum_kreacije_deala",            type: "datetime" },
  "DATUM I REOPTIN":                    { key: "datum_i_reoptin",                   type: "datetime" },
  "DATUM NAKUPA":                       { key: "datum_nakupa",                      type: "datetime" },
  "DATUM ODSTOPA OD POGODBE":           { key: "datum_odstopa_od_pogodbe",          type: "datetime" },
  "DATUM PREDAJE NA IZTERJAVO":         { key: "datum_predaje_na_izterjavo",        type: "datetime" },
  "DEAL ID (V TABELI PRODANIH)":        { key: "deal_id_v_tabeli_prodanih",         type: "number" },
  "DODELJEN DEMO DOSTOP":               { key: "dodeljen_demo_dostop",              type: "select" },
  "ELEKTRONSKI NASLOV":                 { key: "emails",                            type: "multi_email" },
  "ENTITETA":                           { key: "entiteta",                          type: "select" },
  "KODA ZA POPUST":                     { key: "koda_za_popust",                    type: "text" },
  "Last Stage Change Date":             { key: "moved_to_stage_on",                 type: "datetime" },
  "MOBILE NUMBER":                      { key: "mobile_numbers",                    type: "multi_phone" },
  "NAČIN PLAČILA":                      { key: "nain_plaila",                       type: "select" },
  "NOTE #1":                            { key: "note_1",                            type: "textarea" },
  "NOTE #2":                            { key: "note_2",                            type: "textarea" },
  "1.1. SPLETNI OBRAZEC I OPCIJE":      { key: "11_spletni_obrazec_i_opcije",       type: "select" },
  "1.2. SPLETNI OBRAZEC I DATUM OPCIJE":{ key: "12_spletni_obrazec_i_datum_opcije", type: "datetime" },
  "2.1. KLIC I GENERAL":               { key: "21_klic_i_general",                 type: "select" },
  "2.2. KLIC I DATUM GENERAL":         { key: "22_klic_i_datum_general",            type: "datetime" },
  "2.3. KLIC I OPCIJE":                { key: "23_klic_i_opcije",                   type: "select" },
  "2.4. KLIC I DATUM OPCIJE":          { key: "24_klic_i_datum_opcije",             type: "datetime" },
  "3.1. GMAIL I GENERAL":              { key: "31_gmail_i_general",                 type: "select" },
  "3.2. GMAIL I DATUM GENERAL":        { key: "32_gmail_i_datum_general",           type: "datetime" },
};

// "Added On" used for deal created_at
const ADDED_ON_COL = "Added On";

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/);
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const vals: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
    else { cur += ch; }
  }
  vals.push(cur);
  return vals.map(v => v.trim().replace(/^"+|"+$/g, ""));
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const platform = await prisma.platform.findFirst({ where: { slug: PLATFORM_SLUG } });
  if (!platform) throw new Error(`Platform '${PLATFORM_SLUG}' not found`);
  const platformId = platform.id;

  const defaultUser = await prisma.user.findFirst();
  if (!defaultUser) throw new Error("No users found");

  // Load all deal fields for this platform
  const dealFields = await prisma.dealField.findMany({
    where: { platform_id: platformId, is_active: true },
    select: { id: true, field_key: true, field_type: true },
  });
  const fieldByKey = new Map(dealFields.map(f => [f.field_key, f]));

  // Load existing options for all select fields
  const allOptions = await prisma.dealFieldOption.findMany({
    where: { field: { platform_id: platformId } },
    select: { id: true, field_id: true, label: true, value: true, sort_order: true },
  });

  // Cache: field_id → Map<label, option.value>
  const optionCache = new Map<string, Map<string, string>>();
  const optionCount = new Map<string, number>();
  for (const opt of allOptions) {
    if (!optionCache.has(opt.field_id)) optionCache.set(opt.field_id, new Map());
    optionCache.get(opt.field_id)!.set(opt.label, opt.value);
    optionCount.set(opt.field_id, (optionCount.get(opt.field_id) ?? 0) + 1);
  }

  // Auto-create a DealFieldOption if it doesn't exist yet
  async function getOrCreateOption(fieldKey: string, label: string): Promise<string | null> {
    const field = fieldByKey.get(fieldKey);
    if (!field) return null;

    if (!optionCache.has(field.id)) optionCache.set(field.id, new Map());
    const cache = optionCache.get(field.id)!;

    if (cache.has(label)) return cache.get(label)!;

    // Create new option — value = label (raw value kept as-is)
    const count = (optionCount.get(field.id) ?? 0) + 1;
    optionCount.set(field.id, count);
    const created = await prisma.dealFieldOption.create({
      data: { field_id: field.id, label, value: label, sort_order: count },
      select: { value: true },
    });
    cache.set(label, created.value);
    return created.value;
  }

  // Parse CSV
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const records = parseCSV(content);
  console.log(`Parsed ${records.length} rows`);

  let created = 0, skipped = 0, errors = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const contactIdRaw = (row["Contact ID"] ?? "").trim();

    if (!contactIdRaw) { skipped++; continue; }
    if (SKIP_CONTACT_IDS.has(contactIdRaw)) { skipped++; continue; }

    try {
      // Find contact by serial_id stored as field_values->>'contact_id'
      const contacts = await prisma.$queryRawUnsafe<{ id: string; user_id: string }[]>(
        `SELECT id, user_id FROM "Contact"
         WHERE platform_id = $1
           AND field_values->>'contact_id' = $2
         LIMIT 1`,
        platformId,
        contactIdRaw
      );

      if (contacts.length === 0) {
        console.log(`Row ${i + 2}: contact not found for ID ${contactIdRaw} (${row["Contact"] ?? ""})`);
        skipped++;
        continue;
      }

      const contact = contacts[0];
      const fieldValues: Record<string, unknown> = {};

      for (const [csvCol, { key, type }] of Object.entries(COL_TO_FIELD)) {
        const raw = (row[csvCol] ?? "").trim();
        if (!raw) continue;

        if (type === "select") {
          const optVal = await getOrCreateOption(key, raw);
          if (optVal) fieldValues[key] = optVal;
        } else if (type === "datetime" || type === "date") {
          const d = parseDate(raw);
          if (d) fieldValues[key] = d.toISOString();
        } else if (type === "number") {
          const n = parseFloat(raw.replace(/[^\d.-]/g, ""));
          if (!isNaN(n)) fieldValues[key] = n;
        } else if (type === "multi_email") {
          fieldValues[key] = [{ address: raw, is_main: true }];
        } else if (type === "multi_phone") {
          fieldValues[key] = [{ number: raw, note: "" }];
        } else {
          // text, textarea
          fieldValues[key] = raw;
        }
      }

      // Parse created_at from "Added On"
      const addedOnRaw = (row[ADDED_ON_COL] ?? "").trim();
      const createdAt = parseDate(addedOnRaw);

      // Also store d_datum_kreacije_dela if "Added On" has a value
      if (createdAt && !fieldValues["d_datum_kreacije_dela"]) {
        fieldValues["d_datum_kreacije_dela"] = createdAt.toISOString();
      }

      await prisma.deal.create({
        data: {
          contact_id: contact.id,
          user_id: contact.user_id,
          platform_id: platformId,
          field_values: fieldValues as never,
          ...(createdAt ? { created_at: createdAt } : {}),
        },
      });

      created++;
    } catch (e) {
      errors++;
      if (errors <= 10) console.error(`Row ${i + 2} error:`, e instanceof Error ? e.message : e);
    }

    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r${i + 1}/${records.length} | created: ${created} | skipped: ${skipped} | errors: ${errors}`);
    }
  }

  process.stdout.write(`\r${records.length}/${records.length} | created: ${created} | skipped: ${skipped} | errors: ${errors}\n`);
  console.log("\nDone!");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
