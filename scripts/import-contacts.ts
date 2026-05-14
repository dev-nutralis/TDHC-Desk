/**
 * One-time import script for kontakti_i_all_20260514_0748.csv → Evalley SI
 * Run: npx tsx scripts/import-contacts.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as fs from "fs";
import * as readline from "readline";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── CSV parser ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  result.push(field);
  return result;
}

async function readCSV(filePath: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const lines: string[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath, "utf8") });
  for await (const line of rl) lines.push(line);

  if (lines.length === 0) throw new Error("Empty CSV");
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx]?.trim() ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

// ── Name split ──────────────────────────────────────────────────────────────

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = path.resolve(__dirname, "../kontakti_i_all_20260514_0748.csv");

  // 1. Get Evalley platform ID
  const platform = await prisma.platform.findFirst({ where: { slug: "evalley" } });
  if (!platform) throw new Error("Platform 'evalley' not found");
  const platformId = platform.id;
  console.log(`Platform: ${platform.name} (${platformId})`);

  // 2. Get platform's default user (first user via UserPlatform join)
  const user = await prisma.user.findFirst({
    where: { platforms: { some: { platform_id: platformId } } },
  });
  if (!user) throw new Error("No user found for platform");
  const userId = user.id;
  console.log(`Default user: ${user.first_name} ${user.last_name} (${userId})`);

  // 3. Get contact fields
  const contactFields = await prisma.contactField.findMany({
    where: { platform_id: platformId, is_active: true },
    select: { field_key: true, field_type: true },
  });

  const emailFieldKey  = contactFields.find(f => f.field_type === "multi_email")?.field_key;
  const phoneFieldKey  = contactFields.find(f => f.field_type === "multi_phone")?.field_key;
  const serialIdKey    = contactFields.find(f => f.field_type === "serial_id")?.field_key;
  const dobKey         = contactFields.find(f =>
    f.field_key === "date_of_birth" || f.field_key.includes("birth") || f.field_key === "dob"
  )?.field_key;
  const genderKey      = contactFields.find(f =>
    f.field_key === "gender" || f.field_key === "spol" ||
    f.field_key.includes("gender") || f.field_key.includes("sex")
  )?.field_key;

  console.log("Field mapping:");
  console.log(`  multi_email  → ${emailFieldKey ?? "NOT FOUND"}`);
  console.log(`  multi_phone  → ${phoneFieldKey ?? "NOT FOUND"}`);
  console.log(`  serial_id    → ${serialIdKey ?? "NOT FOUND"}`);
  console.log(`  date_of_birth→ ${dobKey ?? "NOT FOUND"}`);
  console.log(`  gender       → ${genderKey ?? "NOT FOUND"}`);

  // 4. Parse CSV
  console.log(`\nReading CSV: ${csvPath}`);
  const { rows } = await readCSV(csvPath);
  console.log(`Found ${rows.length} rows`);

  // 5. Import contacts
  let created = 0;
  let skipped = 0;
  const errors: { row: number; name: string; msg: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // 1-based + header

    try {
      const fv: Record<string, unknown> = {};

      // Name
      const { first_name, last_name } = splitName(raw["Contact"] ?? "");
      fv.first_name = first_name;
      fv.last_name = last_name;

      if (!first_name && !last_name) { skipped++; continue; }

      // Emails
      if (emailFieldKey) {
        const emails: { address: string; is_main: boolean }[] = [];
        const mainEmail = raw["Email address"]?.trim();
        const addEmail  = raw["DODATNI EMAIL #2"]?.trim();
        if (mainEmail) emails.push({ address: mainEmail, is_main: true });
        if (addEmail)  emails.push({ address: addEmail,  is_main: emails.length === 0 });
        if (emails.length) fv[emailFieldKey] = emails;
      }

      // Mobile — strip Excel leading apostrophe
      if (phoneFieldKey) {
        const mobile = (raw["Mobile"] ?? "").trim().replace(/^'+/, "");
        if (mobile) fv[phoneFieldKey] = [{ number: mobile, note: "" }];
      }

      // Date of birth
      if (dobKey) {
        const dob = (raw["DATE OF BIRTH"] ?? "").trim();
        if (dob) fv[dobKey] = dob;
      }

      // Gender: Z = female, M = male
      if (genderKey) {
        const g = (raw["SPOL"] ?? "").trim().toUpperCase();
        if (g === "Z") fv[genderKey] = "female";
        else if (g === "M") fv[genderKey] = "male";
      }

      // Serial ID
      if (serialIdKey) {
        const cid = (raw["Contact ID"] ?? "").trim();
        if (cid) fv[serialIdKey] = cid;
      }

      // created_at
      let createdAt: Date | undefined;
      const dateStr = (raw["DATUM KREACIJE KONTAKTA"] ?? "").trim();
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) createdAt = d;
      }

      await prisma.contact.create({
        data: {
          field_values: fv as never,
          user_id: userId,
          platform_id: platformId,
          ...(createdAt ? { created_at: createdAt } : {}),
        },
      });
      created++;

      if (created % 100 === 0) {
        process.stdout.write(`\r  Progress: ${created}/${rows.length}...`);
      }
    } catch (err) {
      errors.push({
        row: rowNum,
        name: raw["Contact"] ?? "",
        msg: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(`\n\n✓ Import završen`);
  console.log(`  Kreirana: ${created}`);
  console.log(`  Preskočena: ${skipped}`);
  console.log(`  Greške: ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nGreške:");
    errors.slice(0, 20).forEach(e => console.log(`  Red ${e.row} (${e.name}): ${e.msg}`));
    if (errors.length > 20) console.log(`  ... i još ${errors.length - 20} grešaka`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
