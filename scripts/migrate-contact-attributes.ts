import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pkg from "pg";
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const KLAVIYO_SOURCE_ID = "b18008eb-3ad2-498b-8a44-5efc64c21511";

// Dynamic attribute items (without " | FORM" suffix — matches what PHP plugin sends)
const ATTR_KONTAKT_FORMA         = "ca11cda1-bf42-422c-9a77-9a23e7707a66"; // "Kontakt forma"
const ATTR_PRIJAVA_BP            = "414f617a-2f7b-488a-8dda-7ca7d60f36ce"; // "Prijava na besplatni tečaj"
const ATTR_PRIJAVA_SP            = "791efadc-8b0f-4bfa-a5bb-2db4aaebfd0d"; // "Prijava na tečaj | FORM" (only static exists for SP)

async function main() {
  const client = await pool.connect();
  try {
    let updated = 0;

    // 1. Contacts with source "Prijava na besplatni tečaj" (auto-created source, wrong)
    //    → reassign to Klaviyo source + "Prijava na besplatni tečaj" attribute
    const bpContacts = await client.query(`
      SELECT c.id FROM "Contact" c
      JOIN "Source" s ON s.id = c.source_id
      WHERE s.name = 'Prijava na besplatni tečaj'
        AND (c.attribute_ids IS NULL OR c.attribute_ids = 'null' OR c.attribute_ids = '[]')
    `);
    for (const row of bpContacts.rows) {
      await client.query(
        `UPDATE "Contact" SET source_id = $1, attribute_ids = $2 WHERE id = $3`,
        [KLAVIYO_SOURCE_ID, JSON.stringify([ATTR_PRIJAVA_BP]), row.id]
      );
      console.log(`Updated contact ${row.id} → Klaviyo + "Prijava na besplatni tečaj"`);
      updated++;
    }

    // 2. Contacts with source "Prijava na besplatni tečaj" (auto-created source, wrong)
    //    for deals too
    const bpDeals = await client.query(`
      SELECT d.id FROM "Deal" d
      JOIN "Source" s ON s.id = d.source_id
      WHERE s.name = 'Prijava na besplatni tečaj'
        AND (d.attribute_ids IS NULL OR d.attribute_ids = 'null' OR d.attribute_ids = '[]')
    `);
    for (const row of bpDeals.rows) {
      await client.query(
        `UPDATE "Deal" SET source_id = $1, attribute_ids = $2 WHERE id = $3`,
        [KLAVIYO_SOURCE_ID, JSON.stringify([ATTR_PRIJAVA_BP]), row.id]
      );
      console.log(`Updated deal ${row.id} → Klaviyo + "Prijava na besplatni tečaj"`);
      updated++;
    }

    console.log(`\nDone. Updated ${updated} record(s).`);
    console.log(`\nSkipped (no form data available):`);
    console.log(`  - Klaviyo contacts without attribute_ids: Mihajlo Test 5555, Hosting 555333, Simona Šuler`);
    console.log(`  - 4602 contacts with no source`);
    console.log(`  - 34 Email contacts (no attributes defined for Email source)`);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
