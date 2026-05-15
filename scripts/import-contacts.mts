import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

const CSV_PATH = path.join(__dirname, "../kontakti_i_all_20260514_0748.csv");
const PLATFORM_SLUG = "evalley";
const USER_EMAIL = "mihajlo@nutralis.si";

const COL_MAP: Record<string, string> = {
  "contact":                        "full_name",
  "contact id":                     "contact_id",
  "email address":                  "email",
  "datum kreacije kontakta":        "created_at",
  "evalley i contact date created": "created_at_fallback",
  "mobile":                         "mobile",
  "date of birth":                  "date_of_birth",
  "dodatni email #2":               "additional_email",
  "dodatni email":                  "additional_email",
  "spol":                           "gender",
  "street":                         "street",
  "city":                           "city",
  "zip code":                       "zip_code",
};

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"+|"+$/g, ""));
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
      else { cur += ch; }
    }
    vals.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

async function main() {
  const platform = await prisma.platform.findFirst({ where: { slug: PLATFORM_SLUG } });
  if (!platform) throw new Error(`Platform '${PLATFORM_SLUG}' not found`);
  const platformId = platform.id;

  const user = await (prisma.user as { findFirst: (args: unknown) => Promise<{ id: string } | null> }).findFirst({ where: { email: USER_EMAIL } });
  if (!user) throw new Error(`User '${USER_EMAIL}' not found`);
  const userId = user.id;

  const fields = await prisma.contactField.findMany({
    where: { platform_id: platformId, is_active: true },
    select: { field_key: true, field_type: true },
  });

  const emailKey  = fields.find(f => f.field_type === "multi_email")?.field_key;
  const phoneKey  = fields.find(f => f.field_type === "multi_phone")?.field_key;
  const serialKey = fields.find(f => f.field_type === "serial_id")?.field_key;
  const dobKey    = fields.find(f => f.field_key === "date_of_birth" || f.field_key.includes("birth"))?.field_key;
  const genderKey = fields.find(f => ["gender","spol"].includes(f.field_key))?.field_key;
  const streetKey = fields.find(f => f.field_key === "street" || f.field_key.includes("street"))?.field_key;
  const cityKey   = fields.find(f => f.field_key === "city")?.field_key;
  const zipKey    = fields.find(f => ["zip_code","zip"].includes(f.field_key) || f.field_key.includes("postal"))?.field_key;

  console.log("Field keys:", { emailKey, phoneKey, serialKey, dobKey, genderKey, streetKey, cityKey, zipKey });

  const content = fs.readFileSync(CSV_PATH, "utf8");
  const records = parseCSV(content);
  console.log(`Parsed ${records.length} rows from CSV`);

  // Build header→key map from actual CSV headers
  const firstRow = records[0];
  const headerMap: Record<string, string> = {};
  for (const h of Object.keys(firstRow)) {
    const mapped = COL_MAP[h.toLowerCase().trim()];
    if (mapped && !headerMap[mapped]) headerMap[h] = mapped;
  }

  let created = 0, errors = 0;
  const BATCH = 50;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await Promise.all(batch.map(async (raw, bi) => {
      try {
        const row: Record<string, string> = {};
        for (const [col, key] of Object.entries(headerMap)) {
          if (key === "created_at_fallback") { if (!row["created_at"]) row["created_at"] = raw[col] ?? ""; }
          else if (!row[key]) row[key] = (raw[col] ?? "").replace(/^'+/, "");
        }

        const fv: Record<string, unknown> = {};

        // Name split
        const parts = (row.full_name ?? "").trim().split(/\s+/).filter(Boolean);
        fv.first_name = parts[0] ?? "";
        fv.last_name  = parts.slice(1).join(" ");

        // Emails
        if (emailKey) {
          const emails: { address: string; is_main: boolean }[] = [];
          if (row.email?.trim()) emails.push({ address: row.email.trim(), is_main: true });
          if (row.additional_email?.trim()) emails.push({ address: row.additional_email.trim(), is_main: emails.length === 0 });
          if (emails.length > 0) fv[emailKey] = emails;
        }

        // Mobile
        if (phoneKey && row.mobile?.trim()) {
          const m = row.mobile.trim().replace(/^'+/, "");
          if (m) fv[phoneKey] = [{ number: m, note: "" }];
        }

        if (dobKey && row.date_of_birth?.trim()) fv[dobKey] = row.date_of_birth.trim();

        if (genderKey && row.gender?.trim()) {
          const g = row.gender.trim().toUpperCase();
          fv[genderKey] = g === "Z" ? "female" : g === "M" ? "male" : g.toLowerCase();
        }

        if (streetKey && row.street?.trim()) fv[streetKey] = row.street.trim();
        if (cityKey   && row.city?.trim())   fv[cityKey]   = row.city.trim();
        if (zipKey    && row.zip_code?.trim()) fv[zipKey]  = row.zip_code.trim();
        if (serialKey && row.contact_id?.trim()) fv[serialKey] = row.contact_id.trim();

        let createdAt: Date | undefined;
        if (row.created_at?.trim()) {
          const d = new Date(row.created_at.trim());
          if (!isNaN(d.getTime())) createdAt = d;
        }

        await prisma.contact.create({
          data: { field_values: fv, user_id: userId, platform_id: platformId, ...(createdAt ? { created_at: createdAt } : {}) },
        });
        created++;
      } catch (e) {
        errors++;
        if (errors <= 5) console.error(`Row ${i + bi + 2}:`, e instanceof Error ? e.message : e);
      }
    }));

    process.stdout.write(`\r${Math.min(i + BATCH, records.length)}/${records.length} | created: ${created} | errors: ${errors}`);
  }

  console.log(`\n\nDone! Created: ${created}, Errors: ${errors}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); await pool.end(); process.exit(1); });
